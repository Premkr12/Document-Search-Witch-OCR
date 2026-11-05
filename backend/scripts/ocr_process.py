"""
Read text from one or more images with EasyOCR.

Usage: python ocr_process.py --langs en,hi page-0.png page-1.png ...

The model loads once, then each image is read in turn. One JSON object is
printed per image as soon as it finishes, so the caller can report progress:
  {"index": 0, "text": "...", "confidence": 91.4}
  {"index": 1, "error": "..."}
"""

import argparse
import json
import os
import sys

# Ensure stdout and stderr use UTF-8 encoding
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

import easyocr


def join_lines(details):
    """Rebuild reading order from word boxes: group boxes into lines by vertical
    position, then order each line left to right."""
    boxes = []
    for bbox, text, _conf in details:
        ys = [p[1] for p in bbox]
        xs = [p[0] for p in bbox]
        boxes.append((min(ys), max(ys), min(xs), text))
    boxes.sort(key=lambda b: (b[0], b[2]))

    lines = []
    for top, bottom, left, text in boxes:
        middle = (top + bottom) / 2
        if lines and abs(middle - lines[-1]['middle']) < (bottom - top) * 0.6:
            lines[-1]['items'].append((left, text))
        else:
            lines.append({'middle': middle, 'items': [(left, text)]})

    return '\n'.join(' '.join(t for _, t in sorted(line['items'])) for line in lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--langs', default='en')
    parser.add_argument('files', nargs='+')
    args = parser.parse_args()

    # English model plus the requested language, forced CPU mode, no progress bars on stdout
    reader = easyocr.Reader(args.langs.split(','), gpu=False, verbose=False)

    for index, file_path in enumerate(args.files):
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f'File not found: {file_path}')

            details = reader.readtext(file_path, detail=1, paragraph=False)

            # EasyOCR confidence is 0.0-1.0; report the average as a percentage
            confidences = [item[2] for item in details]
            average = (sum(confidences) / len(confidences)) if confidences else 0.0

            result = {
                'index': index,
                'text': join_lines(details),
                'confidence': round(average * 100, 2),
            }
        except Exception as e:
            result = {'index': index, 'error': str(e)}

        print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
