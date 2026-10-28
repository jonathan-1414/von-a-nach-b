#include <pebble.h>

int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

#ifdef PBL_DEBUG
  // Built with `pebble build --debug`: enable the xsbug JavaScript debugger.
  ModdableCreationRecord cr = {
    .recordSize = sizeof(cr),
    .flags = kModdableCreationFlagDebug,
  };
  moddable_createMachine(&cr);
#else
  // Mehr Speicher für JavaScript als der Standard (32 kB zusammen).
  // Mit 32 kB lief die App beim Empfang von 5 Abfahrten in "memory full"
  // (Chunk-Speicher voll, Issue #7). Die Uhr hat 128 kB App-Speicher.
  ModdableCreationRecord cr = {
    .recordSize = sizeof(cr),
    .stack = 6 * 1024,    // Aufrufstapel
    .slot = 20 * 1024,    // Objekte, Zahlen, Variablen
    .chunk = 24 * 1024,   // Texte, Listen, Puffer
  };
  moddable_createMachine(&cr);
#endif

  window_destroy(w);
}
