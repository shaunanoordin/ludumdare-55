import AvO from './avo'
import LD55Story from '@avo/story/types/ld55-story'

var avo
window.onload = function() {
  window.avo = new AvO({ story: LD55Story })
}
