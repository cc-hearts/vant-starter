import { createReadStream, createWriteStream, mkdirSync } from 'fs'
import { readdir } from 'fs/promises'
import inquirer from 'inquirer'
import { join, resolve } from 'path'
import { templateDir } from './config.js'
import { genComponentPrompt, genSelectTemplatePrompt } from './prompt.js'
import { findUpFile } from '@cc-heart/utils-service'
import { fileURLToPath } from 'url'

function readTemplateDirConfig(rootPath: string) {
  return templateDir.map((target) => {
    return {
      value: resolve(rootPath, target),
      name: target.split('/').pop() || '',
    }
  })
}

async function readTemplateComponents(
  templateDir: string,
  componentNameList: string[] = ['src/components']
) {
  const componentList = await Promise.all(
    componentNameList.map(async (componentName) => {
      const componentPath = resolve(templateDir, componentName)
      try {
        const dirs = await readdir(componentPath, { withFileTypes: true })
        return dirs
          .filter((dir) => dir.isDirectory())
          .map((dir) => ({
            value: resolve(componentPath, dir.name),
            name: dir.name,
          }))
      } catch (error) {
        console.log(error)
        return []
      }
    })
  )

  return componentList.reduce((acc, cur) => {
    return [...acc, ...cur]
  }, [])
}

async function getComponentFilePaths(
  componentDir: string,
  relativePath = process.cwd()
) {
  try {
    const dirs = await readdir(componentDir, { withFileTypes: true })
    return dirs
      .filter((dir) => dir.isFile())
      .map((dir) => {
        const dirname = componentDir.split('/').pop() || ''
        return {
          path: resolve(componentDir, dir.name),
          relativePath: join(relativePath, dirname),
          dirname: dir.name,
        }
      })
  } catch (e) {
    return []
  }
}

function writeComponentFile(
  componentPath: string,
  relativePath: string,
  dirname: string
) {
  const dryRun = false
  // dry run output to console
  if (dryRun) {
    console.log(`write file: ${relativePath}`)
    return
  }
  mkdirSync(relativePath, { recursive: true })
  const writeFilePath = resolve(relativePath, dirname)
  const writeStream = createWriteStream(writeFilePath)
  writeStream.on('finish', () => {
    console.log(`write file: ${writeFilePath}`)
  })
  createReadStream(componentPath).pipe(writeStream)
}

async function prompt() {
  const rootPkgPath =
    (await findUpFile(
      resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..'),
      'package.json'
    )) || ''

  if (!rootPkgPath) {
    console.error('not found package.json')
    return
  }

  const rootPath = resolve(rootPkgPath, '..')
  const templateDirConfig = readTemplateDirConfig(rootPath)
  const templatePrompt = genSelectTemplatePrompt(templateDirConfig)
  try {
    const { selectTemplate } = await inquirer.prompt([templatePrompt])
    const componentConfig = await readTemplateComponents(selectTemplate)

    const componentPrompt = genComponentPrompt(componentConfig)
    const { selectComponents } = await inquirer.prompt([componentPrompt])

    const componentPaths = await getComponentFilePaths(selectComponents)
    componentPaths.forEach((config) => {
      writeComponentFile(config.path, config.relativePath, config.dirname)
    })
  } catch (error) {}
}

prompt()
