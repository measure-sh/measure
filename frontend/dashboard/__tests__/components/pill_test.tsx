import Pill from '@/app/components/pill'
import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Pill', () => {
    it('renders correctly', () => {
        const title = 'TITLE'

        const container = render(<Pill title={title} />)

        expect(container).toMatchSnapshot()
    })
})