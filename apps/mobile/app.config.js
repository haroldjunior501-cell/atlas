const fs = require('fs')
const path = require('path')
const app = require('./app.json')

function nvidiaKey() {
  const files = [path.join(__dirname, '.env'), path.join(__dirname, '..', '..', '.env')]
  for (const file of files) {
    if (!fs.existsSync(file)) continue
    const match = fs.readFileSync(file, 'utf8').match(/^NVIDIA_API_KEY=(.*)$/m)
    const value = match?.[1]?.trim()
    if (value) return value
  }
  return ''
}

module.exports = () => ({
  expo: {
    ...app.expo,
    extra: {
      nvidiaApiKey: nvidiaKey(),
    },
  },
})
