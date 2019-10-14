require('dotenv').config()
const fs = require('fs')
const request = require('request')
const req = request.defaults({ baseUrl: process.env.CYOA_EDITOR_URL + '/' })

const resources = [
  'areas',
  'items',
  'locations',
  'lootTables',
  'media',
  'npcs',
  'paths',
  'quests',
  'scenes',
  'scriptures',
  'settings'
]

const init = async function () {
  try {
    // Download and save content files
    const data = await Promise.all(resources.map(resource => getResource(resource)))
    await Promise.all(resources.map((resource, index) => {
      let content = JSON.parse(data[index])
      content = JSON.stringify(content, null, 2)
      return fs.promises.writeFile(`content/${resource}.json`, content)
    }))

    // Create an index for content files
    const contentIndex = resources.reduce((total, resource) => {
      total = total + `\n  '${resource}': require('./${resource}.json'),`
      return total
    }, '')

    await fs.promises.writeFile('content/index.js', `module.exports = {${contentIndex}\n}`)

    // Download and save media files
    const fileFormat = 'png'
    const media = JSON.parse(data[resources.indexOf('media')])
    await Promise.all(media.data.map(entity => downloadMedia(entity, fileFormat)))

    // Generate index file for media files
    const mediaIndex = media.data.reduce((total, entity) => {
      total = total + `\n  '${entity._id}': require('./${entity._id}.${fileFormat}'),`
      return total
    }, '')

    await fs.promises.writeFile('media/index.js', `module.exports = {${mediaIndex}\n}`)
  } catch (error) {
    console.log(error)
  } finally {
    console.log('Content updated 💫')
    process.exit()
  }
}

const downloadMedia = function (entity, fileFormat) {
  const file = fs.createWriteStream(`media/${entity._id}.${fileFormat}`)

  return new Promise((resolve, reject) => {
    req({
      url: `media/${entity._id}`,
      qs: {
        width: 600
      },
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
      }
    })
    .pipe(file)
    .on('finish', () => {
      resolve()
    })
    .on('error', (error) => {
      reject(error)
    })
  })
}

const getResource = function (resource) {
  return new Promise((resolve, reject) => {
    req({
      method: 'GET',
      qs: {
        $limit: 5000
      },
      url: resource
    }, function (error, response, body) {
      if (error) {
        reject(error)
      } else {
        resolve(body)
      }
    })
  })
}

init()
