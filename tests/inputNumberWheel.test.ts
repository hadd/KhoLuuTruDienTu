// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { Input } from '@/components/ui/input'

describe('Input type=number mouse wheel behavior', () => {
  it('blurs the input on wheel event when type is number', () => {
    const { container } = render(
      createElement(Input, { type: 'number', defaultValue: '42' })
    )
    const input = container.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()

    const blurSpy = vi.spyOn(input, 'blur')

    // Simulate wheel event
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true })
    input.dispatchEvent(event)

    expect(blurSpy).toHaveBeenCalled()
  })

  it('does not blur on wheel event when type is text', () => {
    const { container } = render(
      createElement(Input, { type: 'text', defaultValue: 'hello' })
    )
    const input = container.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()

    const blurSpy = vi.spyOn(input, 'blur')

    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true })
    input.dispatchEvent(event)

    expect(blurSpy).not.toHaveBeenCalled()
  })
})
