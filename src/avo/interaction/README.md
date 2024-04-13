## Interaction

An Interaction (or more accurately, an Interaction Menu) describes a standalone
UI package (think HTML `<form>`) that allows players to interact with the
non-action parts of the game.

For example, going up to an NPC and "interacting" with them might open an
"NPCTalkInteraction" menu, which allows the player to have a conversation.

- `Interaction.js` provides the base code for all Interaction types.
- An Interaction Menu is activated in the app via
  `AvO.setInteractionMenu(myInteraction)`. Doing so pauses the game and loads
  the specified Interaction Menu into the HTML.
- Note: the Home Menu (aka System Menu) is separate from any Interaction Menu,
  and has higher priority.
