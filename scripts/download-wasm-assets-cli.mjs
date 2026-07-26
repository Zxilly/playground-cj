#!/usr/bin/env node
import { ensureWasmAssets } from './download-wasm-assets.mjs'

await ensureWasmAssets()
