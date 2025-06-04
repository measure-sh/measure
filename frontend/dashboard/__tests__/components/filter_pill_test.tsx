import FilterPill from '@/app/components/filter_pill'
import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('FilterPill', () => {
    it('renders correctly', () => {
        const title = 'TITLE'

        const container = render(<FilterPill title={title} />)

        expect(container).toMatchSnapshot()
    })
})