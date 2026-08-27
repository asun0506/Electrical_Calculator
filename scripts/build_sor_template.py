"""Build the browser-ready SOR schema and tokenized DOCX from the public template.

Usage:
  python scripts/build_sor_template.py "D:/Desktop/SOR Template.docx"

The source document is never modified. The generated JavaScript embeds a copy whose
yellow input areas are replaced with stable tokens while all other OOXML parts stay intact.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import re
import sys
import zipfile
from collections import OrderedDict
from pathlib import Path

from lxml import etree


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "js" / "sor-template-data.js"
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{W_NS}}}"
NS = {"w": W_NS}
YELLOW = {"yellow", "darkyellow", "ffff00", "fff2cc", "ffff99", "ffeb9c"}


TABLE_CONFIG = {
    0: ("fixed", "文档封面与基本信息", None, None),
    3: ("repeatable", "版本与变更记录", 0, 1),
    4: ("repeatable", "零件清单", 0, 1),
    5: ("fixed", "合作伙伴类型", 0, None),
    6: ("repeatable", "客供件清单", 1, 2),
    8: ("fixed", "项目代号", None, None),
    9: ("repeatable", "项目节点计划", 0, 1),
    10: ("repeatable", "样件需求", 0, 1),
    11: ("repeatable", "法规与认证要求", 0, 1),
    12: ("repeatable", "其他法规要求", 0, 1),
    13: ("repeatable", "推荐法规要求", 0, 1),
    14: ("fixed", "零件综述", 0, None),
    15: ("repeatable", "合作伙伴能力需求", 1, 2),
    16: ("repeatable", "合作伙伴开发责任", 1, 2),
    17: ("repeatable", "技术评审前交付物", 1, 2),
    18: ("repeatable", "装车交样前交付物", 1, 2),
    19: ("repeatable", "项目交付物与时间计划", 0, 1),
    22: ("fixed", "安装位置与图示", 0, None),
    23: ("fixed", "目标几何尺寸和重量", 0, None),
    24: ("fixed", "工作温湿度范围", 0, None),
    25: ("fixed", "储存温湿度范围", 0, None),
    26: ("fixed", "工作目标海拔", None, None),
    27: ("fixed", "目标设计寿命", None, None),
    28: ("repeatable", "机械接口零件清单", 0, 1),
    29: ("fixed", "机械接口图解", 0, None),
    30: ("fixed", "电气接口图解", 0, None),
    31: ("repeatable", "引脚分配及端子定义", 0, 1),
    32: ("repeatable", "连接器型号", 0, 1),
    33: ("fixed", "产品功能与性能需求", 0, None),
    34: ("fixed", "系统结构与硬件需求", 0, None),
    35: ("repeatable", "包装与运输要求", 0, 1),
    36: ("repeatable", "技术规范清单", 0, 1),
    37: ("repeatable", "可靠性测试项目", 0, 1),
}

# In label/value forms the first column is explanatory context even where the
# template highlights the whole row. Only the value column belongs in the form.
FIXED_EDITABLE_COLS = {
    8: {1},
    14: {1},
    23: {1},
    24: {1},
    25: {1},
    26: {1},
    27: {1},
    33: {1},
    34: {1},
}


def text_of(node: etree._Element) -> str:
    parts: list[str] = []
    for item in node.iter():
        if item.tag == W + "t" and item.text:
            parts.append(item.text)
        elif item.tag == W + "tab":
            parts.append("\t")
        elif item.tag == W + "br":
            parts.append("\n")
    return "".join(parts).strip()


def is_yellow(node: etree._Element) -> bool:
    for item in node.iter():
        if item.tag == W + "highlight" and item.get(W + "val", "").lower() in YELLOW:
            return True
        if item.tag == W + "shd" and item.get(W + "fill", "").lower() in YELLOW:
            return True
    return False


def replace_node_text(node: etree._Element, token: str) -> None:
    texts = node.xpath(".//w:t", namespaces=NS)
    if not texts:
        paragraphs = node.xpath(".//w:p", namespaces=NS)
        paragraph = paragraphs[0] if paragraphs else etree.SubElement(node, W + "p")
        run = etree.SubElement(paragraph, W + "r")
        texts = [etree.SubElement(run, W + "t")]
    texts[0].text = token
    texts[0].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    for item in texts[1:]:
        item.text = ""


def replace_yellow_runs(paragraph: etree._Element, token: str) -> bool:
    runs = [run for run in paragraph.xpath("./w:r", namespaces=NS) if is_yellow(run)]
    if not runs:
        return False
    texts = [item for run in runs for item in run.xpath(".//w:t", namespaces=NS)]
    if not texts:
        return False
    texts[0].text = token
    texts[0].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    for item in texts[1:]:
        item.text = ""
    return True


def compact_label(value: str, fallback: str) -> str:
    clean = re.sub(r"\s+", " ", value).strip()
    if not clean:
        return fallback
    return clean if len(clean) <= 46 else clean[:43] + "…"


def cell_rows(table: etree._Element) -> list[list[etree._Element]]:
    return [row.xpath("./w:tc", namespaces=NS) for row in table.xpath("./w:tr", namespaces=NS)]


def nearest_context(body_items: list[dict], body_index: int) -> str:
    candidates = []
    for item in body_items:
        if item["bodyIndex"] >= body_index or item["kind"] != "p" or not item["text"]:
            continue
        text = re.sub(r"\s+", " ", item["text"]).strip()
        numbered = item["numbered"] or bool(re.match(r"^(?:\d+(?:\.\d+)*|[一二三四五六七八九十]+[、.])\s*", text))
        if numbered and len(text) <= 150:
            candidates.append(text)
    return candidates[-1] if candidates else "文档封面与基本信息"


def headers_for(row: list[etree._Element]) -> list[str]:
    headers = []
    for index, cell in enumerate(row):
        value = re.sub(r"\s+", " ", text_of(cell)).strip()
        headers.append(value or f"第{index + 1}列")
    return headers


def main(source: Path) -> None:
    source_bytes = source.read_bytes()
    source_hash = hashlib.sha256(source_bytes).hexdigest()
    with zipfile.ZipFile(io.BytesIO(source_bytes), "r") as original:
        members = {name: original.read(name) for name in original.namelist()}

    parser = etree.XMLParser(remove_blank_text=False, recover=False)
    root = etree.fromstring(members["word/document.xml"], parser)
    body = root.find(W + "body")
    body_items = []
    table_index = -1
    paragraph_index = -1
    for body_index, child in enumerate(body):
        if child.tag == W + "p":
            paragraph_index += 1
            numbered = bool(child.xpath("./w:pPr/w:numPr", namespaces=NS))
            body_items.append({"kind": "p", "bodyIndex": body_index, "index": paragraph_index, "text": text_of(child), "numbered": numbered, "node": child})
        elif child.tag == W + "tbl":
            table_index += 1
            body_items.append({"kind": "table", "bodyIndex": body_index, "index": table_index, "text": "", "numbered": False, "node": child})

    fields = []
    tables = []
    sections: OrderedDict[str, dict] = OrderedDict()

    def section_for(context: str) -> dict:
        title = "文档封面与基本信息" if context == "文档封面与基本信息" else context
        if title not in sections:
            sections[title] = {
                "id": f"section_{len(sections) + 1}",
                "title": title,
                "description": f"结合“{title}”上下文填写；可一键恢复模板默认内容。",
                "fieldIds": [],
                "tableIds": [],
            }
        return sections[title]

    # Standalone yellow paragraphs remain ordinary fields; blank highlighted spacers are ignored.
    for item in body_items:
        if item["kind"] != "p" or not item["text"] or not is_yellow(item["node"]):
            continue
        field_id = f"f{len(fields) + 1:03d}"
        token = f"{{{{SOR_{field_id.upper()}}}}}"
        if not replace_yellow_runs(item["node"], token):
            continue
        context = nearest_context(body_items, item["bodyIndex"])
        # Cover placeholders occur before the first numbered body chapter.
        if item["bodyIndex"] < 100:
            context = "文档封面与基本信息"
        default = item["text"]
        field = {
            "id": field_id,
            "token": token,
            "label": compact_label(default, f"正文填写项 {len(fields) + 1}"),
            "default": default,
            "context": context,
            "hint": f"模板原文位于“{context}”；请按上下文替换，或保留默认内容。",
            "type": "textarea" if len(default) > 55 or "\n" in default else "text",
            "source": f"word/document.xml/p{item['index']}",
        }
        fields.append(field)
        section_for(context)["fieldIds"].append(field_id)

    # Table input regions are presented as tables in the calculator.
    for item in body_items:
        if item["kind"] != "table" or item["index"] not in TABLE_CONFIG:
            continue
        mode, title, header_row, data_start = TABLE_CONFIG[item["index"]]
        rows = cell_rows(item["node"])
        table_id = f"t{item['index']:02d}"
        context = "文档封面与基本信息" if item["index"] in {0, 3} else nearest_context(body_items, item["bodyIndex"])
        table = {
            "id": table_id,
            "mode": mode,
            "title": title,
            "context": context,
            "hint": "表格按原模板结构填写。" if mode == "fixed" else "按表头逐列填写，可根据项目需要添加或删除行。",
            "source": f"word/document.xml/tbl{item['index']}",
        }
        if mode == "repeatable":
            assert header_row is not None and data_start is not None
            table["headers"] = headers_for(rows[header_row])
            table["rowTokens"] = []
            table["defaults"] = []
            for row_index in range(data_start, len(rows)):
                row = rows[row_index]
                tokens = []
                defaults = []
                for col_index, cell in enumerate(row):
                    token = f"{{{{SOR_{table_id.upper()}_R{row_index - data_start}_C{col_index}}}}}"
                    defaults.append(text_of(cell))
                    replace_node_text(cell, token)
                    tokens.append(token)
                table["rowTokens"].append(tokens)
                table["defaults"].append(defaults)
            table["tokens"] = table["rowTokens"][0] if table["rowTokens"] else []
            if not table["defaults"]:
                table["defaults"] = [[""] * len(table["headers"])]
        else:
            grid = []
            tokens_grid = []
            defaults = []
            for row_index, row in enumerate(rows):
                grid_row = []
                token_row = []
                default_row = []
                for col_index, cell in enumerate(row):
                    default = text_of(cell)
                    allowed_cols = FIXED_EDITABLE_COLS.get(item["index"])
                    editable = is_yellow(cell) and row_index != header_row and (allowed_cols is None or col_index in allowed_cols)
                    token = None
                    if editable:
                        token = f"{{{{SOR_{table_id.upper()}_R{row_index}_C{col_index}}}}}"
                        replace_node_text(cell, token)
                    grid_row.append({"text": default, "editable": editable})
                    token_row.append(token)
                    default_row.append(default if editable else "")
                grid.append(grid_row)
                tokens_grid.append(token_row)
                defaults.append(default_row)
            table["grid"] = grid
            table["tokensGrid"] = tokens_grid
            table["defaults"] = defaults
        tables.append(table)
        section_for(context)["tableIds"].append(table_id)

    members["word/document.xml"] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone="yes")

    # Sync the yellow header identifier to the cover SOR number and version.
    header_parts = []
    for name in sorted(key for key in members if re.fullmatch(r"word/header\d+\.xml", key)):
        header = etree.fromstring(members[name], parser)
        changed = False
        for paragraph in header.xpath(".//w:p", namespaces=NS):
            if is_yellow(paragraph) and replace_yellow_runs(paragraph, "{{SOR_AUTO_HEADER}}"):
                changed = True
        if changed:
            members[name] = etree.tostring(header, xml_declaration=True, encoding="UTF-8", standalone="yes")
            header_parts.append(name)

    # Ask Word to refresh TOC/PAGE fields when the generated document opens.
    if "word/settings.xml" in members:
        settings = etree.fromstring(members["word/settings.xml"], parser)
        update = settings.find(W + "updateFields")
        if update is None:
            update = etree.SubElement(settings, W + "updateFields")
        update.set(W + "val", "true")
        members["word/settings.xml"] = etree.tostring(settings, xml_declaration=True, encoding="UTF-8", standalone="yes")

    output_buffer = io.BytesIO()
    with zipfile.ZipFile(output_buffer, "w", zipfile.ZIP_DEFLATED) as generated:
        for name, payload in members.items():
            generated.writestr(name, payload)

    optional = [
        "封面项目阶段、合作伙伴名称、SOR编号与版本是否与项目发布状态一致",
        "版本与变更记录是否需要新增当前版本、作者、日期和变更说明",
        "工程联系人、电话、邮箱等未标黄联系信息是否需要按项目更新",
        "法规、技术规范及强制认证清单是否采用项目适用的最新版本",
        "样件、项目节点、交付物日期及双方职责是否已经项目团队确认",
        "2D/3D/EID、接口定义、连接器和引脚信息是否需要作为附件或表格补充",
        "可靠性测试、工装检具、包装运输及售后服务要求是否适用于本零件",
    ]
    schema = {
        "version": 2,
        "templateName": source.name,
        "sourceSha256": source_hash,
        "pageSize": "A4 portrait",
        "pageCount": 42,
        "previewPageCount": 41,
        "publicTemplate": True,
        "sections": list(sections.values()),
        "fields": fields,
        "tables": tables,
        "sync": {
            "headerToken": "{{SOR_AUTO_HEADER}}",
            "headerParts": header_parts,
            "sorNo": {"tableId": "t00", "row": 3, "col": 1},
            "version": {"tableId": "t00", "row": 4, "col": 1},
        },
        "optionalCandidates": optional,
    }
    payload = {
        "schema": schema,
        "base64": base64.b64encode(output_buffer.getvalue()).decode("ascii"),
    }
    OUTPUT.write_text("window.SOR_TEMPLATE_DATA=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(json.dumps({
        "source": str(source),
        "sourceSha256": source_hash,
        "fields": len(fields),
        "tables": len(tables),
        "sections": len(sections),
        "headerParts": header_parts,
        "output": str(OUTPUT),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: build_sor_template.py <public-template.docx>")
    main(Path(sys.argv[1]).resolve())
