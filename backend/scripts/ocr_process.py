import os
import sys
import json

# Ensure stdout and stderr use UTF-8 encoding
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

import easyocr

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}), file=sys.stderr)
        sys.exit(1)
        
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}), file=sys.stderr)
        sys.exit(1)
        
    try:
        # Initialize reader (English, forced CPU mode)
        # We suppress progress bars and logs so stdout is clean JSON
        reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        
        # Run OCR paragraph=True to get nice paragraphs
        results = reader.readtext(file_path, detail=0, paragraph=True)
        full_text = "\n\n".join(results)
        
        # Run OCR paragraph=False to get confidence score for each text block
        details = reader.readtext(file_path, detail=1, paragraph=False)
        
        # Extract confidence values (item[2]) and calculate average
        # EasyOCR confidence is a float between 0.0 and 1.0
        confidences = [item[2] for item in details if len(item) > 2]
        avg_conf = (sum(confidences) / len(confidences)) if confidences else 0.0
        
        # Convert average confidence to percentage (0-100) and round to 2 decimals
        confidence_percent = round(avg_conf * 100, 2)
        
        # Output result as JSON to stdout
        print(json.dumps({
            "text": full_text,
            "confidence": confidence_percent
        }))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
