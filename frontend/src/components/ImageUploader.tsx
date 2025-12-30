import React, { useRef, useEffect, useState } from "react";
import { PREVIEW_LIMIT } from "../constants";

interface ImageUploaderProps {
    files: File[];
    onFilesChange: (files: File[]) => void;
}

export function ImageUploader({ files, onFilesChange }: ImageUploaderProps): JSX.Element {
    const inputRef = useRef<HTMLInputElement>(null);
    const [thumbs, setThumbs] = useState<string[]>([]);

    useEffect(() => {
        const urls = files.slice(0, PREVIEW_LIMIT).map((f) => URL.createObjectURL(f));
        setThumbs(urls);
        return () => {
            urls.forEach((u) => URL.revokeObjectURL(u));
        };
    }, [files]);

    return (
        <div className="mt-4">
            <div className="border border-dashed border-neutral-700 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
                <p className="text-sm text-neutral-300">Загрузите 8–25 изображений (JPG/PNG/WEBP)</p>
                <button
                    onClick={() => inputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition"
                >
                    Выбрать файлы
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
                />
                {files.length > 0 && <p className="text-xs text-neutral-400">Выбрано: {files.length}</p>}
            </div>
            {thumbs.length > 0 && (
                <div className="mt-3 grid grid-cols-6 gap-2">
                    {thumbs.map((url, index) => (
                        <img key={index} src={url} className="w-full h-20 object-cover rounded-lg border border-neutral-800" />
                    ))}
                </div>
            )}
        </div>
    );
}
