import { useStore } from '@tanstack/react-store'
import { Store } from '@tanstack/store'

import { createMockSchemaFromSeed, createInitialDataConfigState } from '@/features/data-config/lib/mockData'
import {
  toggleField,
  toggleGroupFields,
} from '@/features/data-config/lib/assignmentHelpers'
import type {
  DataConfigStateT,
  DocumentAssignmentConfigT,
  DocumentTypeTemplateT,
} from '@/features/data-config/types'

const dataConfigStoreInstance = new Store<DataConfigStateT>(
  createInitialDataConfigState(),
)

function createEmptyAssignment(templateId: string): DocumentAssignmentConfigT {
  return {
    templateId,
    levels: [],
    fieldKeysByLevelId: {},
  }
}

function ensureAssignment(
  state: DataConfigStateT,
  templateId: string,
): DocumentAssignmentConfigT {
  return (
    state.assignmentsByTemplateId[templateId] ??
    createEmptyAssignment(templateId)
  )
}

function generateTemplateId(): string {
  return `template-${Date.now()}`
}

function generateLevelId(): string {
  return `level-${Date.now()}`
}

export const dataConfigStore = {
  subscribe: dataConfigStoreInstance.subscribe,
  getState: () => dataConfigStoreInstance.state,

  addTemplateFromDossier: (dossierId: string, dossierName: string) => {
    const state = dataConfigStoreInstance.state
    const nextIndex = state.templates.length + 1
    const newTemplate: DocumentTypeTemplateT = {
      id: generateTemplateId(),
      name: `Template ${nextIndex}`,
      sourceDossierId: dossierId,
      sourceDossierName: dossierName,
      groups: createMockSchemaFromSeed(),
    }

    dataConfigStoreInstance.setState({
      ...state,
      templates: [...state.templates, newTemplate],
      assignmentsByTemplateId: {
        ...state.assignmentsByTemplateId,
        [newTemplate.id]: createEmptyAssignment(newTemplate.id),
      },
    })

    return newTemplate
  },

  removeTemplate: (templateId: string) => {
    const state = dataConfigStoreInstance.state
    const { [templateId]: _removed, ...restAssignments } =
      state.assignmentsByTemplateId

    dataConfigStoreInstance.setState({
      ...state,
      templates: state.templates.filter((t) => t.id !== templateId),
      assignmentsByTemplateId: restAssignments,
    })
  },

  addLevel: (templateId: string, name: string) => {
    const state = dataConfigStoreInstance.state
    const assignment = ensureAssignment(state, templateId)
    const newLevel = { id: generateLevelId(), name }

    dataConfigStoreInstance.setState({
      ...state,
      assignmentsByTemplateId: {
        ...state.assignmentsByTemplateId,
        [templateId]: {
          ...assignment,
          levels: [...assignment.levels, newLevel],
          fieldKeysByLevelId: {
            ...assignment.fieldKeysByLevelId,
            [newLevel.id]: [],
          },
        },
      },
    })

    return newLevel
  },

  removeLevel: (templateId: string, levelId: string) => {
    const state = dataConfigStoreInstance.state
    const assignment = ensureAssignment(state, templateId)
    const { [levelId]: _removed, ...restFieldKeys } =
      assignment.fieldKeysByLevelId

    dataConfigStoreInstance.setState({
      ...state,
      assignmentsByTemplateId: {
        ...state.assignmentsByTemplateId,
        [templateId]: {
          ...assignment,
          levels: assignment.levels.filter((l) => l.id !== levelId),
          fieldKeysByLevelId: restFieldKeys,
        },
      },
    })
  },

  toggleFieldForLevel: (
    templateId: string,
    levelId: string,
    fieldKey: string,
    checked: boolean,
  ) => {
    const state = dataConfigStoreInstance.state
    const assignment = ensureAssignment(state, templateId)
    const template = state.templates.find((t) => t.id === templateId)
    if (!template) return

    const currentFields = assignment.fieldKeysByLevelId[levelId] ?? []
    const nextFields = toggleField(
      fieldKey,
      currentFields,
      checked,
      template.groups,
    )

    dataConfigStoreInstance.setState({
      ...state,
      assignmentsByTemplateId: {
        ...state.assignmentsByTemplateId,
        [templateId]: {
          ...assignment,
          fieldKeysByLevelId: {
            ...assignment.fieldKeysByLevelId,
            [levelId]: nextFields,
          },
        },
      },
    })
  },

  toggleGroupForLevel: (
    templateId: string,
    levelId: string,
    groupCode: string,
    checked: boolean,
  ) => {
    const state = dataConfigStoreInstance.state
    const assignment = ensureAssignment(state, templateId)
    const template = state.templates.find((t) => t.id === templateId)
    if (!template) return

    const group = template.groups.find((g) => g.groupCode === groupCode)
    if (!group) return

    const currentFields = assignment.fieldKeysByLevelId[levelId] ?? []
    const nextFields = toggleGroupFields(group, currentFields, checked)

    dataConfigStoreInstance.setState({
      ...state,
      assignmentsByTemplateId: {
        ...state.assignmentsByTemplateId,
        [templateId]: {
          ...assignment,
          fieldKeysByLevelId: {
            ...assignment.fieldKeysByLevelId,
            [levelId]: nextFields,
          },
        },
      },
    })
  },
}

export const useDataConfigStore = <T>(selector: (state: DataConfigStateT) => T) =>
  useStore(dataConfigStoreInstance, selector)
