import type {
  EditorAchievement,
  EditorAction,
  EditorArea,
  EditorItem,
  EditorLocation,
  EditorNpc,
  EditorPath,
  EditorQuest,
  EditorScene,
  EditorScripture,
  EditorSettings
} from '@actnone/editor-untold/dist/types'
import fs from 'fs'

type TTranslationObject = Record<string, string>

const DEFAULT_LOCALE = 'en'
const FOLDER = 'locale'

import content from '../content'

export type TResources = {
  achievements: EditorAchievement[]
  areas: EditorArea[]
  items: EditorItem[]
  locations: EditorLocation[]
  paths: EditorPath[]
  scenes: EditorScene[]
  settings: EditorSettings
}

export const getTranslations = async function () {
  const translations: Record<string, TTranslationObject> = {
    achievements: getAchievementTranslations(
      content.achievements.data as unknown as EditorAchievement[]
    ),
    endings: getEndingTranslations(content.settings.data.ending.partials),
    items: getItemTranslations(content.items.data as EditorItem[]),
    npcs: getNpcTranslations(content.npcs.data as EditorNpc[]),
    quests: getQuestTranslations(content.quests.data as unknown as EditorQuest[]),
    scenes: getSceneTranslations(content.scenes.data as EditorScene[]),
    scriptures: getScriptureTranslations(content.scriptures.data as EditorScripture[]),
    world: getWorldTranslations(
      content.areas.data as EditorArea[],
      content.locations.data as unknown as EditorLocation[],
      content.paths.data as unknown as EditorPath[]
    )
  }

  await Promise.all(
    Object.entries(translations).map(([resource, translations]) => {
      const resourceTranslationsJson = JSON.stringify(translations, null, 2)

      return fs.promises.writeFile(
        `${FOLDER}/${resource}/${DEFAULT_LOCALE}.json`,
        resourceTranslationsJson
      )
    })
  )
}

const addKey = function (translations: TTranslationObject, key: string, value: string) {
  if (translations[key]) {
    throw new Error(`Duplicate key: ${key}`)
  }

  translations[key] = value
}

const collectKeysFromActions = (
  translations: TTranslationObject,
  actions: EditorAction[],
  keyPrefix?: string
) => {
  actions.forEach(action => {
    if (action.type === 'overrideNarrative') {
      action.parameters.forEach((parameter, index) => {
        addKey(translations, `${keyPrefix}-NARR_OVERR-${index}`, parameter)
      })
    }

    if (action.type === 'displayNotification') {
      addKey(translations, `${keyPrefix}-NOTI`, action.parameters[0])
    }

    if (action.type === 'changeHealth' && action.parameters[1]?.length) {
      action.parameters[1].forEach((narrative, index) => {
        if (typeof narrative === 'string') {
          addKey(translations, `${keyPrefix}-DEATH-NARR-${index}`, narrative)
        }
      })
    }

    if (action.type === 'engageInCombat') {
      const [_, __, deathNarratives] = action.parameters

      if (Array.isArray(deathNarratives)) {
        deathNarratives.forEach((narrative, index) => {
          if (typeof narrative === 'string') {
            addKey(translations, `${keyPrefix}-DEATH-NARR-${index}`, narrative)
          }
        })
      }
    }
  })
}

const getSceneTranslations = function (scenes: EditorScene[]) {
  const translations: TTranslationObject = {}

  scenes.forEach(scene => {
    const { _id, nodes } = scene
    const shortSceneId = shortenObjectId(_id)

    nodes.forEach(node => {
      const nodeKeyPrefix = `${shortSceneId}-NODE-${shortenObjectId(node._id)}`

      node.narrative.forEach((narrative, index) => {
        addKey(translations, `${nodeKeyPrefix}-NARR-${index}`, narrative)
      })

      node.options.forEach(option => {
        const optionKeyPrefix = `${nodeKeyPrefix}-OPT-${shortenObjectId(option._id)}`

        collectKeysFromActions(translations, option.actions, optionKeyPrefix)

        option.label.forEach((label, index) => {
          addKey(translations, `${optionKeyPrefix}-LABEL-${index}`, label)
        })

        option.outcomes.forEach(outcome => {
          const outcomeKeyPrefix = `${optionKeyPrefix}-OUTC-${shortenObjectId(outcome._id)}`

          collectKeysFromActions(translations, outcome.actions, outcomeKeyPrefix)

          if (
            outcome.event.type === 'narrative' &&
            outcome.event.parameters.length &&
            Array.isArray(outcome.event.parameters[0])
          ) {
            outcome.event.parameters[0]?.forEach((parameter, index) => {
              addKey(translations, `${outcomeKeyPrefix}-NARR-${index}`, parameter)
            })
          }
        })
      })
    })
  })

  return translations
}

const getWorldTranslations = function (
  areas: EditorArea[],
  locations: EditorLocation[],
  paths: EditorPath[]
) {
  const translations: TTranslationObject = {}

  areas.forEach(area => {
    addKey(translations, `AREA-${area._id}`, area.name)
  })

  locations.forEach(location => {
    addKey(translations, `LOCATION-${location._id}`, location.name)
  })

  paths.forEach(path => {
    path.label.forEach((label, index) => {
      addKey(translations, `PATH-${path._id}-LABEL-${index}`, label)
    })
  })

  return translations
}

const getNpcTranslations = function (npcs: EditorNpc[]) {
  const translations: TTranslationObject = {}

  npcs.forEach(npc => {
    addKey(translations, `NPC-${npc._id}`, npc.name)
  })

  return translations
}

const getItemTranslations = function (items: EditorItem[]) {
  const translations: TTranslationObject = {}

  items.forEach(item => {
    addKey(translations, `ITEM-${item._id}-NAME`, item.name)
    addKey(translations, `ITEM-${item._id}-DESC`, item.description)

    if ('consumption' in item) {
      collectKeysFromActions(translations, item.consumption.actions, `ITEM-${item._id}-CONS`)
    }

    if ('sideEffects' in item) {
      if (item.sideEffects && 'onEquip' in item.sideEffects) {
        collectKeysFromActions(translations, item.sideEffects.onEquip, `ITEM-${item._id}-EQUIP`)
      }

      if (item.sideEffects && 'onUnEquip' in item.sideEffects) {
        collectKeysFromActions(translations, item.sideEffects.onUnEquip, `ITEM-${item._id}-UNEQUIP`)
      }
    }
  })

  return translations
}

const getScriptureTranslations = function (scriptures: EditorScripture[]) {
  const translations: TTranslationObject = {}

  scriptures.forEach(scripture => {
    addKey(translations, `SCRIPTURE-${scripture._id}-CONTENT`, scripture.content)
  })

  return translations
}

const getQuestTranslations = function (quests: EditorQuest[]) {
  const translations: TTranslationObject = {}

  quests.forEach(quest => {
    const questKeyPrefix = `QUEST-${shortenObjectId(quest._id)}`

    addKey(translations, `${questKeyPrefix}-NAME`, quest.name)
    addKey(translations, `${questKeyPrefix}-DESC`, quest.description)

    quest.objectives.forEach(objective => {
      const objectiveKeyPrefix = `${questKeyPrefix}-OBJ-${shortenObjectId(objective._id)}`

      addKey(translations, `${objectiveKeyPrefix}-TITLE`, objective.title)
      addKey(translations, `${objectiveKeyPrefix}-DESC`, objective.description)

      objective.updates.forEach(update => {
        addKey(
          translations,
          `${objectiveKeyPrefix}-UPDATE-${shortenObjectId(update._id)}`,
          update.description
        )
      })
    })
  })

  return translations
}

const getAchievementTranslations = function (achievements: EditorAchievement[]) {
  const translations: TTranslationObject = {}

  achievements.forEach(achievement => {
    const achievementKeyPrefix = `${achievement._id}`

    addKey(translations, `${achievementKeyPrefix}-NAME`, achievement.name)
    addKey(translations, `${achievementKeyPrefix}-DESC`, achievement.description)

    if (achievement.descriptiveTasks) {
      achievement.tasks.forEach(task => {
        addKey(translations, `${achievementKeyPrefix}-TASK-${shortenObjectId(task._id)}`, task.name)
      })
    }
  })

  return translations
}

const getEndingTranslations = function (partials: EditorSettings['ending']['partials']) {
  const translations: TTranslationObject = {}

  partials.forEach(partial => {
    addKey(translations, `ENDING-${partial._id}`, partial.narrative)
  })

  return translations
}

function shortenObjectId(id: string) {
  return id.slice(-6)
}

;(async function () {
  await getTranslations()
})()
