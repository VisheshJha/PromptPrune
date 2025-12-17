/**
 * Script to check if model files are accessible on HuggingFace
 * Run with: node check-model-files.js
 */

const MODEL_ID = 'VisheshKJha/tk-prompt-prune'
const BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/main`

const REQUIRED_FILES = [
  'config.json',
  'tokenizer_config.json',
  'tokenizer.json', // or vocab.json
  'model_quantized.onnx', // or model.onnx
]

const OPTIONAL_FILES = [
  'vocab.json',
  'merges.txt',
  'model.onnx',
  'README.md',
]

async function checkFile(url, filename) {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (response.ok) {
      console.log(`✅ ${filename} - Found (${response.status})`)
      return true
    } else if (response.status === 404) {
      console.log(`❌ ${filename} - Not found (404)`)
      return false
    } else {
      console.log(`⚠️  ${filename} - Error (${response.status})`)
      return false
    }
  } catch (error) {
    console.log(`❌ ${filename} - Network error: ${error.message}`)
    return false
  }
}

async function checkModelFiles() {
  console.log(`\n🔍 Checking model files for: ${MODEL_ID}\n`)
  console.log(`Base URL: ${BASE_URL}\n`)
  console.log('=' .repeat(60))
  
  let allRequiredFound = true
  
  console.log('\n📋 Required Files:')
  for (const file of REQUIRED_FILES) {
    const url = `${BASE_URL}/${file}`
    const found = await checkFile(url, file)
    if (!found) allRequiredFound = false
  }
  
  console.log('\n📋 Optional Files:')
  for (const file of OPTIONAL_FILES) {
    const url = `${BASE_URL}/${file}`
    await checkFile(url, file)
  }
  
  console.log('\n' + '='.repeat(60))
  
  if (allRequiredFound) {
    console.log('\n✅ All required files found! Model should be accessible.')
  } else {
    console.log('\n❌ Some required files are missing. Model will not load.')
    console.log('\n💡 To fix:')
    console.log('   1. Go to https://huggingface.co/' + MODEL_ID)
    console.log('   2. Click "Files and versions" tab')
    console.log('   3. Upload missing files')
    console.log('   4. Make sure model is public (not private)')
  }
  
  console.log('\n🔗 Model page: https://huggingface.co/' + MODEL_ID)
  console.log('🔗 Files page: https://huggingface.co/' + MODEL_ID + '/tree/main')
}

checkModelFiles().catch(console.error)



