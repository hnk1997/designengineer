// Cuts the Selected work reels with macOS's own video engine (AVFoundation + VideoToolbox):
// frame-exact shots, speed changes, transitions, and a proper H.264 / HEVC encode.
//
//   swift scripts/reel/reel.swift info  <movie>
//   swift scripts/reel/reel.swift sheet <movie> <out.png> [frames]        contact sheet with timestamps
//   swift scripts/reel/reel.swift still <movie> <seconds> <out.jpg> [w]   one frame
//   swift scripts/reel/reel.swift cut   <movie> <edit.json> <out.mp4>    the reel
//   swift scripts/reel/reel.swift frames <dir> <out.mp4> [fps] [codec] [bitrate]   a rendered frame sequence
//
// edit.json: { "width": 1512, "height": 982, "fps": 30, "codec": "h264" | "hevc",
//   "bitrate": 2500000, "fadeIn": 0.3, "fadeOut": 0.5,
//   "shots": [ { "from": 1.0, "to": 3.5, "speed": 1.5 } ],
//   "transitions": [ { "type": "fade" | "wipe" | "black", "dur": 0.4 } ] }   one fewer than shots
//   optional "sources": ["more.mov", …] with a shot's "src": 1, 2… to cut between several recordings
// Each shot fills the frame (scaled to cover, centred), so record at the output's shape.
import AVFoundation
import CoreGraphics
import CoreText
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
func fail(_ m: String) -> Never { FileHandle.standardError.write((m + "\n").data(using: .utf8)!); exit(1) }
guard args.count >= 3 else { fail("usage: reel.swift info|sheet|still|cut <movie> …") }

// A writer for either mode: H.264 High or HEVC, BT.709, index at the front for the web
func makeWriter(_ path: String, _ W: Int, _ H: Int, fps: Int, codec: String?, bitrate: Int?) -> (AVAssetWriter, AVAssetWriterInput, AVAssetWriterInputPixelBufferAdaptor) {
  let out = URL(fileURLWithPath: path); try? FileManager.default.removeItem(at: out)
  let writer = try! AVAssetWriter(outputURL: out, fileType: .mp4)
  writer.shouldOptimizeForNetworkUse = true   // index at the front, so the browser can start playing before it has the whole file
  let hevc = codec == "hevc"
  var props: [String: Any] = [AVVideoAverageBitRateKey: bitrate ?? 2_500_000,
                              AVVideoMaxKeyFrameIntervalKey: fps * 2,
                              AVVideoAllowFrameReorderingKey: true,
                              AVVideoExpectedSourceFrameRateKey: fps]
  if !hevc { props[AVVideoProfileLevelKey] = AVVideoProfileLevelH264HighAutoLevel; props[AVVideoH264EntropyModeKey] = AVVideoH264EntropyModeCABAC }
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: hevc ? AVVideoCodecType.hevc : AVVideoCodecType.h264,
    AVVideoWidthKey: W, AVVideoHeightKey: H, AVVideoCompressionPropertiesKey: props,
    AVVideoColorPropertiesKey: [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                                AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                                AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]])
  let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H])
  writer.add(input); writer.startWriting(); writer.startSession(atSourceTime: .zero)
  return (writer, input, adaptor)
}

//   swift scripts/reel/reel.swift frames <dir of f00000.png …> <out.mp4> [fps] [h264|hevc] [bitrate]
// encodes a rendered frame sequence (the McNomNoms journey) at the frames' own size
if args[1] == "frames" {
  let dir = URL(fileURLWithPath: args[2])
  let files = try! FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasSuffix(".png") }.sorted()
  guard let first = files.first, let probe = CGImageSourceCreateWithURL(dir.appendingPathComponent(first) as CFURL, nil),
        let img0 = CGImageSourceCreateImageAtIndex(probe, 0, nil) else { fail("no frames in \(dir.path)") }
  let fps = args.count > 4 ? Int(args[4])! : 30
  let W = img0.width & ~1, H = img0.height & ~1
  let (writer, input, adaptor) = makeWriter(args[3], W, H, fps: fps, codec: args.count > 5 ? args[5] : "h264", bitrate: args.count > 6 ? Int(args[6]) : nil)
  for (f, name) in files.enumerated() {
    let src = CGImageSourceCreateWithURL(dir.appendingPathComponent(name) as CFURL, nil)!
    let img = CGImageSourceCreateImageAtIndex(src, 0, nil)!
    var pb: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
    CVPixelBufferLockBaseAddress(pb!, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: W, height: H, bitsPerComponent: 8,
                        bytesPerRow: CVPixelBufferGetBytesPerRow(pb!), space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    ctx.draw(img, in: CGRect(x: 0, y: H - img.height, width: img.width, height: img.height))
    CVPixelBufferUnlockBaseAddress(pb!, [])
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
    adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(f), timescale: CMTimeScale(fps)))
  }
  input.markAsFinished()
  let sem = DispatchSemaphore(value: 0); writer.finishWriting { sem.signal() }; sem.wait()
  if writer.status != .completed { fail("write failed: \(String(describing: writer.error))") }
  let size = (try? FileManager.default.attributesOfItem(atPath: args[3])[.size] as? Int) ?? 0
  print(String(format: "done %dx%d, %d frames, %.1fs, %d KB", W, H, files.count, Double(files.count) / Double(fps), size / 1024))
  exit(0)
}

let asset = AVURLAsset(url: URL(fileURLWithPath: args[2]))

func syncLoad<T>(_ f: @escaping () async throws -> T) -> T {
  var out: T?
  let sem = DispatchSemaphore(value: 0)
  Task { out = try? await f(); sem.signal() }
  sem.wait()
  guard let v = out else { fail("could not read the movie") }
  return v
}
let track = syncLoad { try await asset.loadTracks(withMediaType: .video).first! }
let natural = syncLoad { try await track.load(.naturalSize) }
let duration = syncLoad { try await asset.load(.duration) }.seconds

let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero

// sample the middle of the recording's frame: asking for exact frame boundaries on a 59.99fps
// screen recording sometimes lands a hair early and repeats or skips a frame (visible as a hitch)
let sourceFps = Double(syncLoad { try await track.load(.nominalFrameRate) })
func frame(at t: Double) -> CGImage {
  let snapped = sourceFps > 0 ? (floor(t * sourceFps + 1e-6) + 0.5) / sourceFps : t
  let time = CMTime(seconds: max(0, min(duration - 0.02, snapped)), preferredTimescale: 60000)
  do { return try generator.copyCGImage(at: time, actualTime: nil) } catch { fail("no frame at \(t): \(error)") }
}

func context(_ w: Int, _ h: Int) -> CGContext {
  CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
}
// draw an image scaled to cover w x h, centred
// "fit": "width" in an edit: wider recordings keep their full width (nothing at the sides is cut),
// anchored to the top like a real browser, the space below filled with the page's own colour
var fitWidth = false
// "zoom": n in an edit scales every shot up by n past cover, centred (e.g. 1.06 trims a recording's white margins)
var zoom: CGFloat = 1
let ciContext = CIContext(options: [.useSoftwareRenderer: false])
func cover(_ ctx: CGContext, _ img: CGImage, _ w: Int, _ h: Int, alpha: CGFloat = 1) {
  if fitWidth && CGFloat(img.width) / CGFloat(img.height) > CGFloat(w) / CGFloat(h) {
    let s = CGFloat(w) / CGFloat(img.width), dh = CGFloat(img.height) * s, band = CGFloat(h) - dh
    ctx.saveGState(); ctx.setAlpha(alpha); ctx.interpolationQuality = .high
    // the page's colour just above its last few rows (which can carry a scrollbar or hairline), as a flat fill
    if let strip = img.cropping(to: CGRect(x: 0, y: img.height - 40, width: img.width, height: 24)) {
      let ci = CIImage(cgImage: strip), avg = CIFilter(name: "CIAreaAverage", parameters: [kCIInputImageKey: ci, kCIInputExtentKey: CIVector(cgRect: ci.extent)])!.outputImage!
      var px = [UInt8](repeating: 0, count: 4)
      ciContext.render(avg, toBitmap: &px, rowBytes: 4, bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
      ctx.setFillColor(CGColor(red: CGFloat(px[0]) / 255, green: CGFloat(px[1]) / 255, blue: CGFloat(px[2]) / 255, alpha: 1))
      ctx.fill(CGRect(x: 0, y: 0, width: CGFloat(w), height: band + 2))
    }
    ctx.draw(img, in: CGRect(x: 0, y: band, width: CGFloat(w), height: dh))
    ctx.restoreGState(); return
  }
  let s = max(CGFloat(w) / CGFloat(img.width), CGFloat(h) / CGFloat(img.height)) * zoom
  let dw = CGFloat(img.width) * s, dh = CGFloat(img.height) * s
  ctx.saveGState(); ctx.setAlpha(alpha)
  ctx.interpolationQuality = .high
  ctx.draw(img, in: CGRect(x: (CGFloat(w) - dw) / 2, y: (CGFloat(h) - dh) / 2, width: dw, height: dh))
  ctx.restoreGState()
}
func save(_ img: CGImage, _ path: String, _ type: UTType) {
  let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, type.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, img, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
  CGImageDestinationFinalize(dest)
}

switch args[1] {
case "info":
  let fps = syncLoad { try await track.load(.nominalFrameRate) }
  print("size \(Int(natural.width))x\(Int(natural.height)) duration \(String(format: "%.2f", duration))s fps \(fps)")

case "sheet":
  let n = args.count > 4 ? Int(args[4])! : 48
  let cols = 6, tw = 320, th = Int(Double(tw) * natural.height / natural.width)
  let rows = (n + cols - 1) / cols
  let ctx = context(tw * cols, th * rows)
  ctx.setFillColor(CGColor(gray: 0, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: tw * cols, height: th * rows))
  for i in 0..<n {
    let t = duration * Double(i) / Double(n)
    let img = frame(at: t)
    let x = (i % cols) * tw, y = (rows - 1 - i / cols) * th
    ctx.draw(img, in: CGRect(x: x, y: y, width: tw, height: th))
    let label = String(format: "%.1fs", t) as NSString
    let attrs: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(red: 0, green: 1, blue: 0.3, alpha: 1), NSAttributedString.Key(kCTFontAttributeName as String): CTFontCreateWithName("Helvetica-Bold" as CFString, 22, nil)]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: label as String, attributes: attrs))
    ctx.textPosition = CGPoint(x: x + 6, y: y + th - 16)
    CTLineDraw(line, ctx)
  }
  save(ctx.makeImage()!, args[3], .png)

case "still":
  let img = frame(at: Double(args[3])!)
  let w = args.count > 5 ? Int(args[5])! : img.width
  let h = Int(Double(w) * Double(img.height) / Double(img.width))
  let ctx = context(w, h); cover(ctx, img, w, h)
  save(ctx.makeImage()!, args[4], args[4].hasSuffix(".png") ? .png : .jpeg)

case "cut":
  struct Shot: Decodable { let from: Double; let to: Double; let speed: Double?; let src: Int? }
  struct Trans: Decodable { let type: String; let dur: Double }
  struct Edit: Decodable { let width: Int; let height: Int; let fps: Int?; let codec: String?; let bitrate: Int?
    let fadeIn: Double?; let fadeOut: Double?; let shots: [Shot]; let transitions: [Trans]; let sources: [String]?; let fit: String?; let zoom: Double? }
  let edit = try! JSONDecoder().decode(Edit.self, from: Data(contentsOf: URL(fileURLWithPath: args[3])))
  let W = edit.width, H = edit.height, fps = edit.fps ?? 30
  fitWidth = edit.fit == "width"
  zoom = CGFloat(edit.zoom ?? 1)
  guard edit.transitions.count == edit.shots.count - 1 else { fail("need one transition between each pair of shots") }
  let len = edit.shots.map { ($0.to - $0.from) / ($0.speed ?? 1) }
  var starts: [Double] = []; var t = 0.0
  for (i, l) in len.enumerated() { starts.append(t); t += l - (i < edit.transitions.count ? edit.transitions[i].dur : 0) }
  let total = t, frames = Int((total * Double(fps)).rounded(.up))

  let (writer, input, adaptor) = makeWriter(args[4], W, H, fps: fps, codec: edit.codec, bitrate: edit.bitrate)

  let ease: (Double) -> Double = { $0 < 0.5 ? 4 * $0 * $0 * $0 : 1 - pow(-2 * $0 + 2, 3) / 2 }
  // more recordings than the one named on the command line: "sources" lists them, a shot's "src" picks one (0 = the command line's)
  let extra: [AVAssetImageGenerator] = (edit.sources ?? []).map { path in
    let g = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: path)))
    g.appliesPreferredTrackTransform = true; g.requestedTimeToleranceBefore = .zero; g.requestedTimeToleranceAfter = .zero
    return g
  }
  func shotImage(_ i: Int, _ u: Double) -> CGImage {
    let s = edit.shots[i], t = min(s.to, s.from + u * (s.speed ?? 1))
    guard let k = s.src, k > 0 else { return frame(at: t) }
    do { return try extra[k - 1].copyCGImage(at: CMTime(seconds: max(0, t), preferredTimescale: 600), actualTime: nil) } catch { fail("no frame at \(t) in source \(k): \(error)") }
  }
  let blue = CGColor(red: 0x25 / 255, green: 0x63 / 255, blue: 0xEB / 255, alpha: 1)

  for f in 0..<frames {
    let time = Double(f) / Double(fps)
    var i = edit.shots.count - 1; while i > 0 && time < starts[i] { i -= 1 }
    var pb: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
    CVPixelBufferLockBaseAddress(pb!, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: W, height: H, bitsPerComponent: 8,
                        bytesPerRow: CVPixelBufferGetBytesPerRow(pb!), space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    ctx.setFillColor(CGColor(gray: 0, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
    let tr = i > 0 ? edit.transitions[i - 1] : nil
    let into = tr != nil ? (time - starts[i]) / tr!.dur : 1
    if let tr = tr, into < 1 {
      let p = ease(max(0, into))
      let a = shotImage(i - 1, time - starts[i - 1]), b = shotImage(i, time - starts[i])
      switch tr.type {
      case "black":
        if p < 0.5 { cover(ctx, a, W, H, alpha: CGFloat(1 - p * 2)) } else { cover(ctx, b, W, H, alpha: CGFloat((p - 0.5) * 2)) }
      case "wipe":
        // the site's own move: the next shot rises from the bottom behind a thin blue rule
        cover(ctx, a, W, H)
        let edgeY = CGFloat(H) * CGFloat(p)            // CoreGraphics' y runs bottom-up
        ctx.saveGState(); ctx.clip(to: CGRect(x: 0, y: 0, width: CGFloat(W), height: edgeY)); cover(ctx, b, W, H); ctx.restoreGState()
        if p > 0 && p < 1 { ctx.setFillColor(blue); ctx.fill(CGRect(x: 0, y: edgeY - 1.5, width: CGFloat(W), height: 3)) }
      default:
        cover(ctx, a, W, H); cover(ctx, b, W, H, alpha: CGFloat(p))
      }
    } else {
      cover(ctx, shotImage(i, time - starts[i]), W, H)
    }
    // ease in from black at the start and out at the end, so the loop closes softly
    let edge = min(edit.fadeIn.map { $0 > 0 ? time / $0 : 1 } ?? 1, edit.fadeOut.map { $0 > 0 ? (total - time) / $0 : 1 } ?? 1)
    if edge < 1 { ctx.setFillColor(CGColor(gray: 0, alpha: CGFloat(1 - ease(max(0, edge))))); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H)) }
    CVPixelBufferUnlockBaseAddress(pb!, [])
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
    adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(f), timescale: CMTimeScale(fps)))
    if f % 60 == 0 { print("frame \(f)/\(frames)") }
  }
  input.markAsFinished()
  let sem = DispatchSemaphore(value: 0); writer.finishWriting { sem.signal() }; sem.wait()
  if writer.status != .completed { fail("write failed: \(String(describing: writer.error))") }
  let size = (try? FileManager.default.attributesOfItem(atPath: args[4])[.size] as? Int) ?? 0
  print(String(format: "done %.1fs, %d frames, %d KB", total, frames, size / 1024))

default: fail("unknown command \(args[1])")
}
