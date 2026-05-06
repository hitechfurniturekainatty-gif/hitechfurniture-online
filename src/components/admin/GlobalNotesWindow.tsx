import { FloatingNotesWindow } from "./FloatingNotesWindow";
import { useNotesWindow, notesWindow } from "./notesWindowStore";

/**
 * Mounted once at the App root so the floating notes window is rendered
 * outside every page/dialog tree. This way it stays exactly where the user
 * left it even when they open the image picker, product gallery, etc.
 */
export const GlobalNotesWindow = () => {
  const { open, notes } = useNotesWindow();
  return (
    <FloatingNotesWindow
      open={open}
      notes={notes}
      onClose={() => notesWindow.close()}
    />
  );
};

export default GlobalNotesWindow;