/** Make asynchronous auth startup last-event-wins and cancel writes after unmount. */
export function createAuthEpoch() {
  let revision = 0;
  let active = true;
  return {
    capture: () => revision,
    advance: () => ++revision,
    isCurrent: (captured: number) => active && captured === revision,
    stop: () => { active = false; revision++; },
  };
}
