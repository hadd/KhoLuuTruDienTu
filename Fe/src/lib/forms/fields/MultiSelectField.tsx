import { SearchSelectMulti } from '@/components/common/SearchSelectMulti'
import { StaticMultiSelect } from '@/components/common/StaticMultiSelect'

import type { FieldRenderer } from '../types'

export const renderMultiSelectField: FieldRenderer = (
  field,
  props,
  options,
  variant,
) => {
  const isDisabled = props.disabled ?? false
  const multiSelectVariant = (variant as 'static' | 'async') ?? 'static'

  // Extract multiselect-specific props from props object
  const multiSelectOptions = props.multiSelectOptions as
    | Array<unknown>
    | undefined
  const queryOptions = props.queryOptions as
    | ((search?: string) => any)
    | undefined
  const getOptionValue = props.getOptionValue as
    | ((item: unknown) => string)
    | undefined
  const getOptionLabel = props.getOptionLabel as
    | ((item: unknown) => string)
    | undefined
  const getOptionDisplay = props.getOptionDisplay as
    | ((item: unknown) => React.ReactNode)
    | undefined
  const excludeIds = props.excludeIds as Array<string> | undefined
  const showSelectedFirst = props.showSelectedFirst as boolean | undefined
  const namespace = props.namespace as string | undefined

  // Ensure we have required functions
  if (!getOptionValue || !getOptionLabel) {
    throw new Error(
      'MultiSelectField requires getOptionValue and getOptionLabel functions',
    )
  }

  // Determine variant: use async only if explicitly set and queryOptions provided
  const useAsync = multiSelectVariant === 'async' && queryOptions

  // Render static variant
  if (!useAsync) {
    if (!multiSelectOptions) {
      throw new Error(
        'MultiSelectField with static variant requires multiSelectOptions',
      )
    }

    return (
      <StaticMultiSelect
        value={field.state.value ?? []}
        onValueChange={field.handleChange}
        options={multiSelectOptions}
        getOptionValue={getOptionValue}
        getOptionLabel={getOptionLabel}
        getOptionDisplay={getOptionDisplay}
        placeholder={props.placeholder}
        disabled={isDisabled}
        className={props.className}
        excludeIds={excludeIds}
        showSelectedFirst={showSelectedFirst ?? false}
        namespace={namespace}
      />
    )
  }

  // Render async variant
  return (
    <SearchSelectMulti
      value={field.state.value ?? []}
      onValueChange={field.handleChange}
      queryOptions={queryOptions}
      getOptionValue={getOptionValue}
      getOptionLabel={getOptionLabel}
      getOptionDisplay={getOptionDisplay}
      placeholder={props.placeholder}
      disabled={isDisabled}
      className={props.className}
      excludeIds={excludeIds}
      showSelectedFirst={showSelectedFirst ?? true}
      namespace={namespace}
    />
  )
}
