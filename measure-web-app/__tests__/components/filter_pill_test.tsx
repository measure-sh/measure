import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { expect, describe, it } from '@jest/globals'
import FilterPill from '@/app/components/filter_pill'

describe('FilterPill', () => {
    it('renders correctly in collapsed state', () => {
        const title = 'TITLE'

        const container = render(<FilterPill title={title} />)

        expect(container).toMatchSnapshot()
    })
})