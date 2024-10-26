require('dotenv').config()
const fs = require('fs')
const request = require('request')
const req = request.defaults({ baseUrl: process.env.CYOA_EDITOR_URL + '/' })

const resources = [
  'achievements',
  'areas',
  'items',
  'locations',
  'lootTables',
  'media',
  'npcs',
  'npcTemplates',
  'paths',
  'quests',
  'scenes',
  'scriptures',
  'settings',
  'variables'
]

const init = async function () {
  const { env } = process

  const updatesToRun = {
    media: {
      audio: env.EXCLUDE === 'media' || env.EXCLUDE === 'media.audio' ? false : true,
      images: env.EXCLUDE === 'media' || env.EXCLUDE === 'media.images' ? false : true
    }
  }

  try {
    // Download and save content files
    const data = await Promise.all(resources.map(resource => getResource(resource)))
    await Promise.all(
      resources.map((resource, index) => {
        let content = JSON.parse(data[index])
        content = JSON.stringify(content, null, 2)
        return fs.promises.writeFile(`content/${resource}.json`, content)
      })
    )

    // Create an index for content files
    const contentIndex = resources.reduce((total, resource) => {
      total = total + `\n  '${resource}': require('./${resource}.json'),`
      return total
    }, '')

    await fs.promises.writeFile('content/index.js', `module.exports = {${contentIndex}\n}`)

    console.log('Content updated 💫')

    const media = JSON.parse(data[resources.indexOf('media')])

    const audio = media.data.filter(e => e.type === 'audio')
    const images = media.data.filter(e => e.type === 'image')
    const audioExtension = 'm4a'
    const imageExtension = 'webp'

    // Generate index file for media files
    const imageIndex = buildIndex(images, imageExtension, 'image')
    const audioIndex = buildIndex(audio, audioExtension, 'audio')

    await fs.promises.writeFile(
      'media/index.js',
      `module.exports = {\n  image: {${imageIndex}\n  },\n  audio: {${audioIndex}\n  }\n}`
    )

    // Download media files
    if (updatesToRun.media.audio) {
      for (let entity of audio) {
        await downloadMedia(entity, audioExtension, {
          invalidate: true,
          audio_codec: 'aac'
        })
      }

      console.log('Audio files updated 💫')
    }

    if (updatesToRun.media.images) {
      const defaultParams = { invalidate: true }
      const backgroundImageParams = { width: 1400 }
      const characterImageParams = { height: 1500 }

      for (let entity of images) {
        if (!entity.category?.length) {
          console.error(`❌ Media ${entity._id} (${entity.name}) is missing category.`)
          return
        }

        const params = Object.assign(
          { ...defaultParams },
          entity.category.includes('background') ? backgroundImageParams : characterImageParams
        )

        await downloadMedia(entity, imageExtension, params)
      }

      console.log('Images updated 💫')
    }
  } catch (error) {
    console.log(error)
  } finally {
    console.log('All done! 💫')
    process.exit()
  }
}

const downloadMedia = function (entity, extension, params) {
  const fileName = `${entity._id}.${extension}`
  const file = fs.createWriteStream(`media/${entity.type}/${fileName}`)
  console.log(`Fetching media/${fileName}...`)

  return new Promise((resolve, reject) => {
    req({
      url: `media/${fileName}`,
      qs: params,
      headers: {
        Accept: `*/${extension}`,
        'Cache-Control': 'max-age=0',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    })
      .pipe(file)
      .on('finish', () => {
        resolve(fileName)
      })
      .on('error', error => {
        reject(error)
      })
  })
}

const buildIndex = function (data = [], extension, path) {
  return data.reduce((total, entity) => {
    total = total + `\n    '${entity._id}': require('./${path}/${entity._id}.${extension}'),`
    return total
  }, '')
}

const getResource = function (resource) {
  const query = {
    $limit: 5000,
    $sort: '_created'
  }

  if (resource === 'scenes') {
    query.$select = [
      '_id',
      'cutScene',
      'name',
      'npcs',
      'audio',
      'background',
      'autoSave',
      'nodes._id',
      'nodes.narrative',
      'nodes.options',
      'nodes.autoSave',
      'nodes.background',
      'nodes.audio',
      'nodes.cutScene',
      'nodes.__v'
    ]
  }

  return new Promise((resolve, reject) => {
    req(
      {
        method: 'GET',
        qs: query,
        url: resource
      },
      function (error, response, body) {
        if (error) {
          reject(error)
        } else {
          resolve(body)
        }
      }
    )
  })
}

init()
