"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CourseFolder, CoursePost } from "@/lib/course-materials/mock-data";
import { FolderCard } from "@/components/course-materials/folder-card";

interface MaterialsHomeClientProps {
  courseName: string;
  canManage: boolean;
  initialPosts: CoursePost[];
  folders: CourseFolder[];
}

export function MaterialsHomeClient({
  courseName,
  canManage,
  initialPosts,
  folders,
}: MaterialsHomeClientProps) {
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [postText, setPostText] = useState("");
  const [posts, setPosts] = useState<CoursePost[]>(initialPosts);

  const now = useMemo(() => new Date(), []);

  const handleCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setCoverPreview(previewUrl);
  };

  const publishPost = () => {
    const message = postText.trim();
    if (!message) return;

    const newPost: CoursePost = {
      id: `local-post-${Date.now()}`,
      author: "Usuario actual",
      role: canManage ? "profesor" : "estudiante",
      message,
      publishedAt: new Date().toISOString(),
    };

    setPosts((prev) => [newPost, ...prev]);
    setPostText("");
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div
          className="relative h-56 bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-700"
          style={
            coverPreview
              ? {
                  backgroundImage: `url(${coverPreview})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />

          {canManage ? (
            <div className="absolute right-4 top-4 z-10">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-gray-900 hover:bg-white">
                <ImagePlus className="h-4 w-4" />
                Subir imagen de fondo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
              </label>
            </div>
          ) : null}

          <div className="absolute bottom-5 left-5 z-10">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {courseName}
            </h1>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Ultimas Publicaciones
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Avisos, recordatorios y novedades del curso.
          </p>

          {canManage ? (
            <div className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <Textarea
                value={postText}
                onChange={(event) => setPostText(event.target.value)}
                placeholder="Escriba una publicacion para el curso..."
                className="min-h-24 bg-white"
              />
              <div className="flex justify-end">
                <Button onClick={publishPost} disabled={!postText.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  Publicar
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Solo administradores y profesores pueden publicar en esta seccion.
            </div>
          )}

          <div className="mt-4 space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-xl border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {post.author}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(post.publishedAt).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <p className="mt-2 text-sm text-gray-700">{post.message}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Calendario</h2>
          <p className="mt-1 text-sm text-gray-600">Fecha actual del sistema</p>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center">
            <p className="text-sm uppercase tracking-wide text-blue-700">
              {now.toLocaleDateString("es-CO", { weekday: "long" })}
            </p>
            <p className="mt-1 text-4xl font-bold text-blue-900">
              {now.getDate()}
            </p>
            <p className="text-sm text-blue-700">
              {now.toLocaleDateString("es-CO", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </article>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Materiales del Curso
        </h2>
        <p className="text-sm text-gray-600">
          Vista rapida de carpetas de contenido y progreso por estudiante.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {folders.map((folder) => (
            <FolderCard key={folder.id} folder={folder} />
          ))}
        </div>
      </section>
    </div>
  );
}
