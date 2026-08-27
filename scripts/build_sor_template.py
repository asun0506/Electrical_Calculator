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


def table_config(title, chapter, heading, data_start, headers=None):
    return {"title": title, "chapter": chapter, "heading": heading, "dataStart": data_start, "headers": headers}


# The public template deliberately uses different visual table patterns.  The
# calculator normalises every input table into the same editable, repeatable UI
# while retaining the original title/header rows in the generated DOCX.
TABLE_CONFIG = {
    0: table_config("文档封面与基本信息", "封面", None, 0, ["项目", "内容"]),
    3: table_config("版本与变更记录", "封面", 0, 1),
    4: table_config("零件清单", "1.1", 0, 1),
    5: table_config("合作伙伴类型", "1.2", None, 1, ["选择", "合作伙伴类型"]),
    6: table_config("客供件清单", "1.2", 1, 2),
    8: table_config("项目代号", "3.1", None, 0, ["项目", "内容"]),
    9: table_config("项目节点计划", "3.2", 0, 1),
    10: table_config("样件需求", "3.3", 0, 1),
    11: table_config("法规与认证要求", "4.0", 0, 1),
    12: table_config("补充法规要求", "4.0", 0, 1),
    13: table_config("推荐法规要求", "4.0", 0, 1),
    14: table_config("零件综述", "5.1", None, 1, ["项目", "内容"]),
    15: table_config("合作伙伴能力需求", "5.2", 1, 2),
    16: table_config("合作伙伴开发责任", "5.2", 1, 2),
    17: table_config("技术评审前交付物", "5.2", 1, 2),
    18: table_config("装车交样前交付物", "5.2", 1, 2),
    19: table_config("项目交付物与时间计划", "5.3", 0, 1),
    22: table_config("安装位置与图示", "5.10.1", 0, 1),
    23: table_config("目标几何尺寸和重量", "5.10.2", None, 1, ["项目", "内容"]),
    24: table_config("工作温湿度范围", "5.10.3", None, 1, ["项目", "内容"]),
    25: table_config("储存温湿度范围", "5.10.4", None, 1, ["项目", "内容"]),
    26: table_config("工作目标海拔", "5.10.5", None, 0, ["项目", "内容"]),
    27: table_config("目标设计寿命", "5.10.6", None, 0, ["项目", "内容"]),
    28: table_config("机械接口零件清单", "5.11.1", 0, 1),
    29: table_config("机械接口图解", "5.11.1", None, 1, ["图片 / 说明"]),
    30: table_config("电气接口图解", "5.11.2.1", None, 1, ["图片 / 说明"]),
    31: table_config("引脚分配及端子定义", "5.11.2.2.1", 0, 1),
    32: table_config("连接器型号", "5.11.2.2.2", 0, 1),
    33: table_config("产品功能与性能需求", "5.12", None, 1, ["需求项目", "要求"]),
    34: table_config("产品功能与性能参数", "5.12", None, 0, ["需求项目", "要求"]),
    35: table_config("系统结构与硬件需求", "5.13", None, 1, ["需求项目", "要求"]),
    36: table_config("包装与运输要求", "5.15.3", 0, 1),
    37: table_config("技术规范清单", "6.2", 0, 1),
    38: table_config("DV/PV 测试计划", "8.2.2", 0, 1),
}

CHAPTER_TITLES = {
    "封面": "文档封面与基本信息",
    "1": "Engineering Summary 工程概述",
    "3": "Project Information 项目信息",
    "4": "Legal Requirements 法规要求",
    "5": "Product Requirements 产品要求",
    "6": "Design Requirement 设计要求",
    "8": "Validation 认证",
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


def headers_for(row: list[etree._Element]) -> list[str]:
    headers = []
    for index, cell in enumerate(row):
        value = re.sub(r"\s+", " ", text_of(cell)).strip()
        headers.append(value or f"第{index + 1}列")
    return headers


def chapter_key(value: str) -> tuple[int, ...]:
    if value == "封面":
        return (0,)
    return tuple(int(part) for part in value.split("."))


def major_chapter(value: str) -> str:
    return "封面" if value == "封面" else value.split(".")[0]


def chapter_label(chapter: str, title: str) -> str:
    return title if chapter == "封面" else f"{chapter} {title}"


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
    ordered_items = []
    configured_tables = {item["index"]: item for item in body_items if item["kind"] == "table" and item["index"] in TABLE_CONFIG}

    # Create a context timeline from configured tables and headings that include
    # their chapter number as ordinary text (common in the validation chapter).
    context_events = []
    for table_index_value, item in configured_tables.items():
        config = TABLE_CONFIG[table_index_value]
        context_events.append((item["bodyIndex"], config["chapter"], config["title"]))
    for item in body_items:
        if item["kind"] != "p":
            continue
        match = re.match(r"^\s*(\d+(?:\.\d+)+)\s*", item["text"])
        if match and "TOC" not in (item["node"].xpath("string(./w:pPr/w:pStyle/@w:val)", namespaces=NS) or ""):
            context_events.append((item["bodyIndex"], match.group(1), item["text"]))
    context_events.sort(key=lambda entry: entry[0])

    def context_before(body_index: int) -> tuple[str, str]:
        available = [entry for entry in context_events if entry[0] < body_index]
        if not available:
            return "封面", CHAPTER_TITLES["封面"]
        _, chapter, title = available[-1]
        return chapter, title

    # Standalone yellow narrative paragraphs remain fields.  Yellow chapter
    # labels/titles are not fields; the table below them is the editable item.
    for position, item in enumerate(body_items):
        if item["kind"] != "p" or not item["text"] or not is_yellow(item["node"]):
            continue
        if item["bodyIndex"] >= 100:
            following = next((candidate for candidate in body_items[position + 1:] if candidate["text"] or candidate["kind"] == "table"), None)
            if item["numbered"] or (following and following["kind"] == "table" and len(item["text"]) < 50):
                continue
        chapter, context = ("封面", CHAPTER_TITLES["封面"]) if item["bodyIndex"] < 100 else context_before(item["bodyIndex"])
        field_id = f"f{len(fields) + 1:03d}"
        token = f"{{{{SOR_{field_id.upper()}}}}}"
        if not replace_yellow_runs(item["node"], token):
            continue
        default = item["text"]
        field = {
            "id": field_id,
            "token": token,
            "label": compact_label(default, f"正文填写项 {len(fields) + 1}"),
            "default": default,
            "chapterNumber": chapter,
            "chapterTitle": context,
            "context": context,
            "hint": f"位于第 {chapter} 章“{context}”；请联系前后文替换，或保留模板默认内容。" if chapter != "封面" else "位于文档封面；请按当前项目替换。",
            "type": "textarea" if len(default) > 55 or "\n" in default else "text",
            "source": f"word/document.xml/p{item['index']}",
            "bodyIndex": item["bodyIndex"],
        }
        fields.append(field)
        ordered_items.append({"type": "field", "id": field_id, "chapter": chapter, "bodyIndex": item["bodyIndex"]})

    # Every configured input table is repeatable, including label/value tables.
    for item in body_items:
        if item["kind"] != "table" or item["index"] not in TABLE_CONFIG:
            continue
        config = TABLE_CONFIG[item["index"]]
        rows = cell_rows(item["node"])
        table_id = f"t{item['index']:02d}"
        header_row = config["heading"]
        data_start = config["dataStart"]
        if data_start >= len(rows):
            raise ValueError(f"Table {item['index']} has no data row at index {data_start}")
        headers = config["headers"] or headers_for(rows[header_row])
        table = {
            "id": table_id,
            "mode": "repeatable",
            "title": config["title"],
            "chapterNumber": config["chapter"],
            "chapterTitle": config["title"],
            "context": chapter_label(config["chapter"], config["title"]),
            "hint": f"第 {config['chapter']} 章：{config['title']}。按表头逐列填写，可根据项目需要添加或删除行。" if config["chapter"] != "封面" else "文档封面与版本信息；可添加或删除行。",
            "source": f"word/document.xml/tbl{item['index']}",
            "headers": headers,
            "rowTokens": [],
            "defaults": [],
            "imageCells": [],
            "imageColumns": [],
            "bodyIndex": item["bodyIndex"],
        }
        image_columns = set()
        image_cells = []
        for row_index in range(data_start, len(rows)):
            row = rows[row_index]
            tokens = []
            defaults = []
            for col_index, cell in enumerate(row):
                token = f"{{{{SOR_{table_id.upper()}_R{row_index - data_start}_C{col_index}}}}}"
                default = text_of(cell)
                defaults.append(default)
                if "附图" in default:
                    image_columns.add(col_index)
                    image_cells.append([row_index - data_start, col_index])
                replace_node_text(cell, token)
                tokens.append(token)
            table["rowTokens"].append(tokens)
            table["defaults"].append(defaults)
        table["tokens"] = table["rowTokens"][0] if table["rowTokens"] else []
        table["imageCells"] = image_cells
        image_rows = {row for row, _ in image_cells}
        table["imageColumns"] = sorted(image_columns) if image_rows and len(image_rows) == len(table["defaults"]) else []
        if not table["defaults"]:
            table["defaults"] = [[""] * len(headers)]
        tables.append(table)
        ordered_items.append({"type": "table", "id": table_id, "chapter": config["chapter"], "bodyIndex": item["bodyIndex"]})

    field_by_id = {field["id"]: field for field in fields}
    table_by_id = {table["id"]: table for table in tables}
    sections: OrderedDict[str, dict] = OrderedDict()
    for item in sorted(ordered_items, key=lambda entry: (chapter_key(entry["chapter"]), entry["bodyIndex"])):
        major = major_chapter(item["chapter"])
        if major not in sections:
            title = CHAPTER_TITLES.get(major, f"第 {major} 章")
            sections[major] = {
                "id": f"section_{major.replace('.', '_')}",
                "chapterNumber": major,
                "title": title if major == "封面" else f"第 {major} 章 · {title}",
                "description": "按文档顺序填写本章表格和文字内容；可一键恢复模板默认内容。",
                "fieldIds": [],
                "tableIds": [],
                "items": [],
            }
        section = sections[major]
        section["items"].append({"type": item["type"], "id": item["id"]})
        if item["type"] == "field":
            section["fieldIds"].append(item["id"])
            field_by_id[item["id"]]["sectionId"] = section["id"]
        else:
            section["tableIds"].append(item["id"])
            table_by_id[item["id"]]["sectionId"] = section["id"]

    members["word/document.xml"] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone="yes")

    # Sync the yellow header identifier to the cover SOR number and version.
    header_parts = []
    for name in sorted(key for key in members if re.fullmatch(r"word/header\d+\.xml", key)):
        header = etree.fromstring(members[name], parser)
        changed = False
        for paragraph in header.xpath(".//w:p", namespaces=NS):
            if is_yellow(paragraph) and replace_yellow_runs(paragraph, "{{SOR_AUTO_HEADER}}"):
                token_seen = False
                for text_node in paragraph.xpath(".//w:t", namespaces=NS):
                    token_seen = token_seen or text_node.text == "{{SOR_AUTO_HEADER}}"
                    if token_seen and text_node.text and re.fullmatch(r"\s*\d+(?:\.\d+)+\s*", text_node.text):
                        text_node.text = ""
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
        "version": 3,
        "templateName": source.name,
        "sourceSha256": source_hash,
        "pageSize": "A4 portrait",
        "pageCount": 57,
        "previewPageCount": 57,
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
