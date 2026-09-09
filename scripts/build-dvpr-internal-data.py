"""Convert the supplied multi-sheet DV workbook into the browser's internal DVP&R data file."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import openpyxl


PRODUCTS = {
    "铸造": ("casting", "铸造件/铸造工艺", "材料与制造"),
    "型材": ("extrusion-profile", "铝型材/型材结构件", "材料与制造"),
    "复合材料": ("composite-material", "复合材料件", "材料与制造"),
    "表面处理": ("surface-treatment", "表面处理/绝缘涂层", "材料与制造"),
    "防腐蚀": ("corrosion-protection", "防腐蚀设计", "材料与制造"),
    "气密": ("leak-tightness", "气密结构/密封总成", "密封与热管理"),
    "焊接": ("welding", "焊接结构/焊缝", "材料与制造"),
    "紧固件": ("fastener", "紧固件/螺纹连接", "材料与制造"),
    "塑料件": ("plastic", "塑料结构件", "结构件"),
    "橡胶圈": ("rubber-o-ring", "O形圈/橡胶密封圈", "密封与热管理"),
    "密封垫": ("sealing-gasket", "密封垫", "密封与热管理"),
    "线束": ("lv-harness", "低压线束", "线束"),
    "一代VAVE水快换": ("water-quick-connect-gen1", "一代水快换接头", "换电与热管理"),
    "二代水快换": ("water-quick-connect-gen2", "二代水快换接头", "换电与热管理"),
    "底部冷却水冷板": ("bottom-cooling-plate", "底部液冷板", "换电与热管理"),
    "侧面冷却水冷板": ("side-cooling-plate", "侧面液冷板", "换电与热管理"),
    "电芯间弹性体": ("cell-elastomer", "电芯间弹性体", "隔热与缓冲"),
    "防爆阀": ("vent-valve", "防爆阀/泄压阀", "安全部件"),
    "气凝胶": ("aerogel", "气凝胶隔热垫", "隔热与缓冲"),
    "底部防护泡棉": ("bottom-protection-foam", "底部防护泡棉", "隔热与缓冲"),
    "上盖支撑泡棉": ("upper-support-foam", "上盖支撑泡棉", "隔热与缓冲"),
    "外保温棉": ("outer-insulation-foam", "外保温棉", "隔热与缓冲"),
    "电快换": ("electric-swap-connector", "换电高压连接器总成", "换电与热管理"),
    "FPC": ("fpc", "FPC/柔性采样板", "电路板"),
    "Busbar": ("cu-busbar", "铜/铝汇流排", "导电连接件"),
}

# zero-based: test, description, reference, acceptance, sample; special modes are handled below.
LAYOUT = {
    "铸造": (1, 2, 3, 4, None), "型材": (0, 1, 2, 3, 7),
    "复合材料": (1, 2, 3, 4, None), "表面处理": (3, 4, 5, 6, None),
    "防腐蚀": (1, 2, 3, 4, None), "气密": (1, 2, 3, 4, None),
    "焊接": (1, 2, 3, 4, None), "紧固件": (1, 2, 3, 4, None),
    "塑料件": (1, 2, 3, 4, None), "橡胶圈": (0, 1, 2, 3, None),
    "密封垫": (1, 2, 3, 4, None), "线束": (1, 2, 3, 4, None),
    "一代VAVE水快换": (1, 2, 3, 4, 5), "二代水快换": (1, 2, 3, 4, 5),
    "底部冷却水冷板": (1, 2, 3, 4, 6), "侧面冷却水冷板": (1, 2, 3, 4, 5),
    "电芯间弹性体": (1, 2, 3, 4, 5), "防爆阀": (1, 2, 3, 4, None),
    "气凝胶": (1, 2, 3, 4, None), "底部防护泡棉": (1, 2, 3, 4, 5),
    "上盖支撑泡棉": (1, 2, 3, 4, 5), "外保温棉": (1, 2, 3, 4, 5),
    "电快换": (1, 2, 3, 4, 5), "FPC": (1, 2, 3, 4, 5), "Busbar": (1, 2, 3, 4, 5),
}


def text(value) -> str:
    if value is None:
        return ""
    return re.sub(r"[ \t]+", " ", str(value).replace("\r", "")).strip()


def cell(values, index) -> str:
    return text(values[index]) if index is not None and index < len(values) else ""


def header_or_section(value: str) -> bool:
    lower = value.lower()
    return ("test name" in lower or "测试项目" in value or lower.startswith("no.")
            or " level" in lower or re.match(r"^\d+(?:\.\d+)*\.?\s*(basic|interface|component|performance)", lower))


def valid_reference(value: str) -> bool:
    compact = value.strip().lower()
    return compact not in {"", "/", "\\", "na", "n/a", "sor", "图纸", "2d图纸要求"}


def build(source: Path) -> dict:
    workbook = openpyxl.load_workbook(source, data_only=True, read_only=True)
    profiles: dict[str, list[list[object]]] = {}
    products: dict[str, dict[str, str]] = {}
    source_stats = {}
    for sheet in workbook.worksheets:
        if sheet.title not in PRODUCTS:
            continue
        product_id, product_name, category = PRODUCTS[sheet.title]
        products[product_id] = {"id": product_id, "name": product_name, "category": category, "sourceSheet": sheet.title}
        targets = [product_id]
        if sheet.title == "Busbar":
            targets = ["cu-busbar", "al-busbar"]
        layout = LAYOUT[sheet.title]
        rows = []
        previous_test = ""
        for row_no, raw in enumerate(sheet.iter_rows(values_only=True), 1):
            values = list(raw)
            test = cell(values, layout[0])
            description = cell(values, layout[1])
            reference = cell(values, layout[2])
            acceptance = cell(values, layout[3])
            sample = cell(values, layout[4]) or "3"
            if header_or_section(test):
                continue
            if sheet.title == "密封垫":
                subtest = description
                description = reference
                reference = description if re.search(r"(?:GB|ISO|IEC|ASTM|UL|SAE|QC/T|IPX?\d)", description, re.I) else ""
                test = " - ".join(part for part in (test, subtest) if part)
            elif sheet.title == "橡胶圈":
                if test:
                    previous_test = test
                elif previous_test and description:
                    test = f"{previous_test} - {description}"
            elif sheet.title == "复合材料":
                extra = "；".join(cell(values, i) for i in range(6, min(len(values), 9)) if cell(values, i))
                if extra:
                    acceptance = f"{acceptance}；{extra}" if acceptance else extra
            if not test or header_or_section(test):
                continue
            if not any((description, reference, acceptance)):
                continue
            reference_note = reference if valid_reference(reference) else "内部经验/项目要求"
            clause = f"内部数据库 · {sheet.title} · 原表第{row_no}行 · 参考：{reference_note}"
            pre = "记录试验前外观、尺寸及相关基础功能/性能"
            environment = "按内部数据库条目描述及项目实际安装边界"
            post = "复测试验涉及的外观、尺寸、功能和性能参数"
            procedure = description or "按内部数据库条目和批准的试验作业指导书执行"
            criteria = acceptance or "满足图纸、SOR和项目批准的验收限值"
            rows.append([test, "内部数据库", clause, sample, pre, environment, procedure, post, criteria])
        for target in targets:
            profiles.setdefault(target, []).extend(rows)
        source_stats[sheet.title] = len(rows)
    return {"version": 1, "products": list(products.values()), "profiles": profiles, "sourceStats": source_stats}


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: build-dvpr-internal-data.py <source.xlsx> <output.js>")
    payload = build(Path(sys.argv[1]))
    output = Path(sys.argv[2])
    output.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    output.write_text(
        "/** Generated from the authorized internal DV workbook; do not hand-edit. */\n"
        "window.DVPR_INTERNAL_LIBRARY=" + data + ";\n",
        encoding="utf-8",
    )
    print(json.dumps({"output": str(output), "products": len(payload["products"]), "rows": sum(payload["sourceStats"].values()), "sourceStats": payload["sourceStats"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
