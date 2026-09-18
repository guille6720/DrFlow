"use client";

type TelemedicineRoomEmbedProps = {
  roomUrl: string;
  embedUrl: string;
  title?: string;
  onLeave?: () => void;
};

export function TelemedicineRoomEmbed({
  roomUrl,
  embedUrl,
  title = "Videoconsulta NexClinic",
}: TelemedicineRoomEmbedProps) {
  return (
    <div className="flex h-[min(80vh,720px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-sm text-slate-200">
        <span>{title}</span>
        <a
          href={roomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-300 hover:text-teal-200"
        >
          Abrir en pestaña nueva
        </a>
      </div>
      <iframe
        title={title}
        src={embedUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="h-full w-full flex-1 border-0 bg-black"
      />
    </div>
  );
}
