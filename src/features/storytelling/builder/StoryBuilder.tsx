import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Play, Pause, Plus, MapPin, Trash2 } from 'lucide-react';

interface StoryScene {
  id: string;
  title: string;
  description: string;
  center: [number, number];
  zoom: number;
}

export function StoryBuilder() {
  const [scenes, setScenes] = useState<StoryScene[]>([
    {
      id: '1',
      title: 'Introduction — Pampanga Basin',
      description: 'Overview of the flood-prone region and current hazards.',
      center: [120.5887, 15.145],
      zoom: 11,
    },
  ]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentScene, setCurrentScene] = useState(0);

  const addScene = () => {
    const newScene: StoryScene = {
      id: String(Date.now()),
      title: `Scene ${scenes.length + 1}`,
      description: 'Add narration and media for this location.',
      center: [120.5887, 15.145],
      zoom: 11,
    };
    setScenes([...scenes, newScene]);
  };

  const removeScene = (id: string) => {
    setScenes(scenes.filter((s) => s.id !== id));
  };

  return (
    <div className="glass w-full max-w-md rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-200">
          <BookOpen className="h-4 w-4 text-[#5500a4]" />
          Storytelling
        </h3>
        <span className="font-mono text-[10px] text-slate-400">{scenes.length} scenes</span>
      </div>

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#5500a4] py-2 text-[12px] font-medium text-white hover:brightness-110"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {isPlaying ? 'Pause' : 'Auto-play'}
        </button>
        <button
          onClick={addScene}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium text-slate-200 hover:bg-white/10"
        >
          <Plus className="h-3.5 w-3.5" />
          Add scene
        </button>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {scenes.map((scene, index) => (
          <motion.div
            key={scene.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border p-3 text-left transition ${
              index === currentScene
                ? 'border-[#5500a4]/50 bg-[#5500a4]/10'
                : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'
            }`}
            onClick={() => setCurrentScene(index)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 font-mono text-[10px] text-slate-300">
                  {index + 1}
                </span>
                <p className="text-[12px] font-medium text-slate-200">{scene.title}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeScene(scene.id);
                }}
                className="text-slate-400 hover:text-[#E63946]"
                aria-label="Remove scene"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{scene.description}</p>
            <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-slate-500">
              <MapPin className="h-3 w-3" />
              {scene.center[1].toFixed(4)}, {scene.center[0].toFixed(4)} · Z{scene.zoom}
            </p>
          </motion.div>
        ))}
      </div>

      <p className="mt-3 text-center font-mono text-[10px] text-slate-500">
        Scenes are saved locally · Share via link (coming soon)
      </p>
    </div>
  );
}
