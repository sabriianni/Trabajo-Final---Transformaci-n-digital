import zipfile
import xml.etree.ElementTree as ET
import json
import os

def convert():
    xlsx_path = "dataset_alojamientos_transformacion_digital.xlsx"
    if not os.path.exists(xlsx_path):
        print("Excel file not found.")
        return
        
    try:
        with zipfile.ZipFile(xlsx_path) as z:
            # Read shared strings
            shared_strings = []
            try:
                ss_xml = z.read("xl/sharedStrings.xml")
                ss_root = ET.fromstring(ss_xml)
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in ss_root.findall('.//ns:si', ns):
                    t_nodes = si.findall('.//ns:t', ns)
                    text = "".join([t.text for t in t_nodes if t.text])
                    shared_strings.append(text)
            except KeyError:
                print("No shared strings.")
                
            # Read worksheet
            s_xml = z.read("xl/worksheets/sheet1.xml")
            s_root = ET.fromstring(s_xml)
            ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            rows_data = {}
            for row in s_root.findall('.//ns:row', ns):
                r_idx = int(row.attrib.get('r'))
                rows_data[r_idx] = {}
                for cell in row.findall('ns:c', ns):
                    cell_ref = cell.attrib.get('r')
                    cell_type = cell.attrib.get('t')
                    val_node = cell.find('ns:v', ns)
                    val = ""
                    if val_node is not None and val_node.text:
                        val = val_node.text
                        if cell_type == 's':
                            idx = int(val)
                            val = shared_strings[idx] if idx < len(shared_strings) else val
                    col_letter = "".join([c for c in cell_ref if c.isalpha()])
                    rows_data[r_idx][col_letter] = val
            
            # Map column letters to header names
            header_row = rows_data[1]
            col_map = {col: header_row[col] for col in header_row}
            print("Columns mapping:", col_map)
            
            bookings = []
            for r_idx in sorted(rows_data.keys()):
                if r_idx == 1:
                    continue # Skip header
                row = rows_data[r_idx]
                if not row:
                    continue
                booking = {}
                for col in col_map:
                    col_name = col_map[col]
                    val = row.get(col, "")
                    
                    # Convert types
                    if col_name in ['id_reserva', 'cantidad_noches']:
                        try:
                            val = int(val) if val else 0
                        except:
                            val = 0
                    elif col_name in ['tarifa_noche_ars', 'ingreso_total_ars', 'ocupacion_destino_pct', 'comision_booking_ars']:
                        try:
                            val = float(val) if val else 0.0
                            # Convert integer float to int for cleaner look
                            if val.is_integer():
                                val = int(val)
                        except:
                            val = 0.0
                    booking[col_name] = val
                bookings.append(booking)
                
            print(f"Parsed {len(bookings)} bookings.")
            
            # Output JS file
            js_content = f"// Data generated from {xlsx_path}\nconst BOOKINGS_DATA = {json.dumps(bookings, indent=2, ensure_ascii=False)};\n"
            with open("data.js", "w", encoding="utf-8") as f:
                f.write(js_content)
            print("Wrote data.js successfully.")
            
    except Exception as e:
        print("Error during conversion:", e)

if __name__ == "__main__":
    convert()
