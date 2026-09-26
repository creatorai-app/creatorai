import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ConnectionLost } from "@repo/ui/connection-lost"

/**
 * The screen itself is markup, but two things in it are behaviour: the status
 * line reads live connectivity, and the retry button is the only way out. Both
 * are worth pinning, because the page is only ever seen when something is
 * already going wrong.
 */

/** Drive navigator.onLine and fire the matching window event, like a real drop. */
function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value })
  act(() => {
    window.dispatchEvent(new Event(value ? "online" : "offline"))
  })
}

describe("ConnectionLost", () => {
  afterEach(() => setOnline(true))

  it("renders the headline and a way forward", () => {
    render(<ConnectionLost />)
    expect(screen.getByRole("heading", { name: "Connection lost" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
  })

  it("announces itself, since it replaces whatever the user was looking at", () => {
    render(<ConnectionLost />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("blames the server when the browser still has a network", () => {
    setOnline(true)
    render(<ConnectionLost />)
    expect(screen.getByText(/server isn't responding/i)).toBeInTheDocument()
  })

  it("blames the network when the browser reports offline", () => {
    render(<ConnectionLost />)
    setOnline(false)
    expect(screen.getByText(/you appear to be offline/i)).toBeInTheDocument()
  })

  it("follows the connection back up without a reload", async () => {
    render(<ConnectionLost />)
    setOnline(false)
    expect(screen.getByText(/you appear to be offline/i)).toBeInTheDocument()

    setOnline(true)
    expect(screen.getByText(/server isn't responding/i)).toBeInTheDocument()
  })

  it("calls a caller-supplied retry instead of reloading", async () => {
    const onRetry = jest.fn()
    render(<ConnectionLost onRetry={onRetry} />)

    await userEvent.click(screen.getByRole("button", { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("disables retry while one is already in flight, so it cannot be double-fired", async () => {
    let release: () => void = () => {}
    const onRetry = jest.fn(() => new Promise<void>((r) => { release = r }))
    render(<ConnectionLost onRetry={onRetry} />)

    const button = screen.getByRole("button", { name: /try again/i })
    await userEvent.click(button)

    expect(screen.getByRole("button", { name: /reconnecting/i })).toBeDisabled()
    await act(async () => { release() })
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("hides the secondary action until somewhere to go is given", () => {
    const { rerender } = render(<ConnectionLost />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()

    rerender(<ConnectionLost homeHref="/dashboard" />)
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute("href", "/dashboard")
  })

  it("accepts copy overrides for surfaces that lost something specific", () => {
    render(<ConnectionLost title="Editor disconnected" description="Your draft is saved." />)
    expect(screen.getByRole("heading", { name: "Editor disconnected" })).toBeInTheDocument()
    expect(screen.getByText("Your draft is saved.")).toBeInTheDocument()
  })
})
