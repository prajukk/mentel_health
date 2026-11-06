import assert from "node:assert/strict"
import { encodeWav } from "../frontend/src/audio.js"

const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 0]), 16000)
const bytes = new Uint8Array(wav)
const text = new TextDecoder().decode(bytes.slice(0, 44))

assert.equal(text.slice(0, 4), "RIFF")
assert.equal(text.slice(8, 12), "WAVE")
assert.equal(text.slice(36, 40), "data")
assert.equal(bytes.length, 44 + 8)
console.log("wav conversion ok")
