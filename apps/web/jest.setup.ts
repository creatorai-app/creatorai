// Registers the DOM matchers (toBeInTheDocument, toBeDisabled, toHaveAttribute).
// @testing-library/jest-dom has been a dependency for a while but was never
// wired up, so component tests could render and then not assert on the result.
import "@testing-library/jest-dom"
