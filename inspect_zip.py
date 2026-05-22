import zipfile
import xml.etree.ElementTree as ET
import os

def inspect_docx(docx_path):
    print(f"\n--- Inspecting Word Document: {docx_path} ---")
    if not os.path.exists(docx_path):
        print("File not found.")
        return
    
    try:
        with zipfile.ZipFile(docx_path) as z:
            doc_xml = z.read("word/document.xml")
            root = ET.fromstring(doc_xml)
            
            # Namespaces
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            paragraphs = []
            for p in root.findall('.//w:p', ns):
                texts = [t.text for t in p.findall('.//w:t', ns) if t.text]
                p_text = "".join(texts).strip()
                if p_text:
                    paragraphs.append(p_text)
            
            print(f"Total paragraphs found: {len(paragraphs)}")
            print("First 30 paragraphs:")
            for i, p in enumerate(paragraphs[:30]):
                print(f"[{i+1}] {p}")
                
            # Write to a text file for further reading
            with open("docx_content.txt", "w", encoding="utf-8") as f:
                for i, p in enumerate(paragraphs):
                    f.write(f"[{i+1}] {p}\n")
            print("Wrote all paragraphs to docx_content.txt")
            
    except Exception as e:
        print("Error reading docx:", e)

def inspect_xlsx(xlsx_path):
    print(f"\n--- Inspecting Excel Document: {xlsx_path} ---")
    if not os.path.exists(xlsx_path):
        print("File not found.")
        return
    
    try:
        with zipfile.ZipFile(xlsx_path) as z:
            # 1. Read shared strings
            shared_strings = []
            try:
                ss_xml = z.read("xl/sharedStrings.xml")
                ss_root = ET.fromstring(ss_xml)
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in ss_root.findall('.//ns:si', ns):
                    # Text can be in <t> or nested in <r><t>
                    t_nodes = si.findall('.//ns:t', ns)
                    text = "".join([t.text for t in t_nodes if t.text])
                    shared_strings.append(text)
                print(f"Found {len(shared_strings)} shared strings.")
            except KeyError:
                print("No shared strings found (or error reading them).")
            
            # 2. Read workbook to get sheets
            wb_xml = z.read("xl/workbook.xml")
            wb_root = ET.fromstring(wb_xml)
            ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            sheets = []
            for sheet in wb_root.findall('.//ns:sheet', ns):
                sheets.append({
                    'name': sheet.attrib.get('name'),
                    'sheetId': sheet.attrib.get('sheetId'),
                    'rId': sheet.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                })
            print("Sheets in workbook:", sheets)
            
            # 3. Read worksheets (usually xl/worksheets/sheet1.xml, etc.)
            # We can list sheet files in xl/worksheets/
            sheet_files = [f for f in z.namelist() if f.startswith("xl/worksheets/sheet") and f.endswith(".xml")]
            print("Sheet files:", sheet_files)
            
            for sfile in sorted(sheet_files):
                print(f"\nReading file: {sfile}")
                s_xml = z.read(sfile)
                s_root = ET.fromstring(s_xml)
                
                # Parse rows and cells
                rows_data = {}
                for row in s_root.findall('.//ns:row', ns):
                    r_idx = int(row.attrib.get('r'))
                    rows_data[r_idx] = {}
                    for cell in row.findall('ns:c', ns):
                        cell_ref = cell.attrib.get('r') # e.g. "A1"
                        cell_type = cell.attrib.get('t') # e.g. "s" for shared string, "n" for number
                        val_node = cell.find('ns:v', ns)
                        val = ""
                        if val_node is not None and val_node.text:
                            val = val_node.text
                            if cell_type == 's':
                                idx = int(val)
                                val = shared_strings[idx] if idx < len(shared_strings) else val
                        
                        # Extract column letter
                        col_letter = "".join([c for c in cell_ref if c.isalpha()])
                        rows_data[r_idx][col_letter] = val
                
                print(f"Total rows parsed: {len(rows_data)}")
                # Show first 10 rows
                sorted_row_indices = sorted(rows_data.keys())
                
                # Write sheet content to a text file for further reading
                sheet_txt_name = f"excel_{os.path.basename(sfile).replace('.xml', '')}_content.txt"
                with open(sheet_txt_name, "w", encoding="utf-8") as f:
                    for r in sorted_row_indices:
                        row_cells = rows_data[r]
                        sorted_cols = sorted(row_cells.keys(), key=lambda x: (len(x), x))
                        row_str = " | ".join([f"{c}:{row_cells[c]}" for c in sorted_cols])
                        f.write(f"Row {r}: {row_str}\n")
                print(f"Wrote all rows to {sheet_txt_name}")
                
                print("First 15 rows preview:")
                for r in sorted_row_indices[:15]:
                    row_cells = rows_data[r]
                    sorted_cols = sorted(row_cells.keys(), key=lambda x: (len(x), x))
                    row_str = " | ".join([f"{c}:{row_cells[c]}" for c in sorted_cols])
                    print(f"Row {r:2d}: {row_str}")
                    
    except Exception as e:
        print("Error reading xlsx:", e)

if __name__ == "__main__":
    inspect_docx("TRABAJO FINAL Transformacion Digital.docx")
    inspect_xlsx("dataset_alojamientos_transformacion_digital.xlsx")
