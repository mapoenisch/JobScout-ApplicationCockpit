// OCR per macOS Vision: swift ocr.swift bild.png  ->  erkannter Text auf stdout
import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1,
      let bild = NSImage(contentsOfFile: CommandLine.arguments[1]),
      let cg = bild.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(1) }
let anfrage = VNRecognizeTextRequest()
anfrage.recognitionLevel = .accurate
anfrage.recognitionLanguages = ["de-DE", "en-US"]
anfrage.usesLanguageCorrection = true
try VNImageRequestHandler(cgImage: cg).perform([anfrage])
let zeilen = (anfrage.results ?? []).compactMap { $0.topCandidates(1).first?.string }
print(zeilen.joined(separator: "\n"))
