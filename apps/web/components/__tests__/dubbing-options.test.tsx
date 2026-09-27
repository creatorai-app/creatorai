import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DubKeyterms } from "@/components/dashboard/dubbing/DubKeyterms"
import { DubTimeline } from "@/components/dashboard/dubbing/DubTimeline"
import { DubVoiceModePicker } from "@/components/dashboard/dubbing/DubVoiceMode"
import { speakerName } from "@/components/dashboard/dubbing/DubOutputsList"

/**
 * The new-dub options that carry rules (keyterms follow ElevenLabs' limits, voice mode
 * explains itself per engine) and the timeline, whose rows are the way into the player.
 */

function Keyterms({ initial = [] as string[] }) {
  const [terms, setTerms] = useState(initial)
  return <DubKeyterms value={terms} onChange={setTerms} />
}

describe("DubKeyterms", () => {
  it("adds a term on Enter and several from a comma-separated paste, without duplicates", async () => {
    render(<Keyterms />)
    const input = screen.getByRole("textbox", { name: "Add a name or term" })
    await userEvent.type(input, "Creator AI{Enter}")
    await userEvent.type(input, "Cypher, creator ai, Modal{Enter}")
    const chips = screen.getAllByRole("listitem").map((li) => li.textContent)
    expect(chips).toEqual(["Creator AI", "Cypher", "Modal"])
  })

  it("explains a term ElevenLabs would refuse, and keeps it out", async () => {
    render(<Keyterms />)
    const input = screen.getByRole("textbox", { name: "Add a name or term" })
    await userEvent.type(input, "one two three four five six{Enter}")
    expect(screen.getByText("Keep each term to 5 words")).toBeInTheDocument()
    await userEvent.clear(input)
    await userEvent.type(input, "a<b>{Enter}")
    expect(screen.getByText(/Terms cannot contain/)).toBeInTheDocument()
    expect(screen.queryAllByRole("listitem")).toHaveLength(0)
  })

  it("removes a term with its button", async () => {
    render(<Keyterms initial={["Creator AI", "Cypher"]} />)
    await userEvent.click(screen.getByRole("button", { name: "Remove Cypher" }))
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Creator AI"])
  })
})

describe("DubVoiceModePicker", () => {
  it("says what each mode does on the chosen engine, with no em dashes", async () => {
    const onChange = jest.fn()
    render(<DubVoiceModePicker engine="elevenlabs" value="balanced" onChange={onChange} />)
    const radios = screen.getAllByRole("radio")
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"])
    expect(radios.every((r) => !r.textContent?.includes("—"))).toBe(true)
    await userEvent.click(screen.getByRole("radio", { name: /Sound native/ }))
    expect(onChange).toHaveBeenCalledWith("native")
  })
})

describe("DubTimeline", () => {
  const segments = [
    { id: "0", speaker: "S1", start: 1.2, end: 3, sourceText: "Hello there.", translation: "Hola.", dubStart: 1.3, dubEnd: 2.6 },
    { id: "1", speaker: "S2", start: 64, end: 65, sourceText: "Hm.", translation: null },
  ]

  it("opens to every line, and plays the dub from a clicked line", async () => {
    const onSeek = jest.fn()
    render(<DubTimeline segments={segments} speakerLabel={speakerName} onSeek={onSeek} />)
    await userEvent.click(screen.getByRole("button", { name: /Timeline/ }))
    expect(screen.getByText("Hola.")).toBeInTheDocument()
    expect(screen.getByText("Speaker 1")).toBeInTheDocument()
    expect(screen.getByText("Not dubbed")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Play from 0:01.3" }))
    expect(onSeek).toHaveBeenCalledWith(1.3)
    // A line with no dub time plays from its source time.
    await userEvent.click(screen.getByRole("button", { name: "Play from 1:04.0" }))
    expect(onSeek).toHaveBeenLastCalledWith(64)
  })
})

describe("speakerName", () => {
  it("names Cypher and ElevenLabs speakers the same way", () => {
    expect(speakerName("S2")).toBe("Speaker 2")
    expect(speakerName("speaker_0")).toBe("Speaker 1")
    expect(speakerName("narrator")).toBe("narrator")
  })
})
