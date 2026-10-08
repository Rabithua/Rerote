#!/usr/bin/env bash
set -euo pipefail
# Requires the Emscripten 4.0.18 SDK. Runtime encoding happens only in browser workers.
codec_build_dir=$(mktemp -d)
trap 'rm -rf "$codec_build_dir"' EXIT
curl -fsSL https://storage.googleapis.com/downloads.webmproject.org/releases/webp/libwebp-1.6.0.tar.gz -o "$codec_build_dir/source.tar.gz"
tar -xzf "$codec_build_dir/source.tar.gz" -C "$codec_build_dir"
codec_sources=("$codec_build_dir"/libwebp-1.6.0/src/{enc,dsp,utils}/*.c "$codec_build_dir"/libwebp-1.6.0/sharpyuv/*.c)
emcc -O3 -I"$codec_build_dir/libwebp-1.6.0" "${codec_sources[@]}" \
  -s STANDALONE_WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=16777216 \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_WebPFree","_WebPEncodeRGBA","_WebPGetEncoderVersion"]' \
  --no-entry -o public/codecs/webp-1.6.0.wasm
cp "$codec_build_dir/libwebp-1.6.0/COPYING" public/codecs/libwebp-COPYING.txt
cp "$codec_build_dir/libwebp-1.6.0/PATENTS" public/codecs/libwebp-PATENTS.txt
shasum -a 256 public/codecs/webp-1.6.0.wasm
