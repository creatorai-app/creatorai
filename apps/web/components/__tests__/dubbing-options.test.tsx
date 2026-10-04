import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DubTimeline } from "@/components/dashboard/dubbing/DubTimeline"
import { DubVoiceModePicker } from "@/components/dashboard/dubbing/DubVoiceMode"
import { DubOutputFormatPicker } from "@/components/dashboard/dubbing/DubOutputFormat"
import { speakerName } from "@/components/dashboard/dubbing/DubOutputsList"

/**
 * The voice mode picker (it explains itself per engine on hover) and the timeline, whose
 * rows are the way into the player.
 */

describe("DubVoiceModePicker", () => {
  it("says what each mode does on the chosen engine, with no em dashes", async () => {
    const onChange = jest.fn()
    render(<DubVoiceModePicker engine="elevenlabs" value="balanced" onChange={onChange} />)
    const radios = screen.getAllByRole("radio")
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"])
    expect(radios.every((r) => r.title && !r.title.includes("—"))).toBe(true)
    await userEvent.click(screen.getByRole("radio", { name: /Sound native/ }))
    expect(onChange).toHaveBeenCalledWith("native")
  })
})

describe("DubOutputFormatPicker", () => {
  it("offers video, MP3 and WAV for a video, and only audio for an audio file", async () => {
    const onChange = jest.fn()
    const { rerender } = render(<DubOutputFormatPicker value="mp4" onChange={onChange} allowVideo />)
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Video (MP4)", "Audio only (MP3)", "Audio only (WAV)"])
    await userEvent.click(screen.getByRole("radio", { name: "Audio only (WAV)" }))
    expect(onChange).toHaveBeenCalledWith("wav")
    rerender(<DubOutputFormatPicker value="mp3" onChange={onChange} allowVideo={false} />)
    expect(screen.queryByRole("radio", { name: "Video (MP4)" })).toBeNull()
    expect(screen.getByRole("radio", { name: "Audio only (MP3)" })).toHaveAttribute("aria-checked", "true")
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
