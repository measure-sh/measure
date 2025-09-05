"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/button';
import { Edit2 } from 'lucide-react';

interface SamplingEditableTitleProps {
    initialValue?: string | null;
    onTitleChange?: (title: string) => void;
    showEditButton?: boolean;
    isLoading?: boolean;
}

const SamplingEditableTitle = ({ initialValue, onTitleChange, showEditButton = true, isLoading = false }: SamplingEditableTitleProps) => {
    const [title, setTitle] = useState<string>(initialValue || "");
    const [isEditing, setIsEditing] = useState<boolean>(false);

    useEffect(() => {
        if (initialValue && initialValue !== title && !isEditing) {
            setTitle(initialValue);
        }
    }, [initialValue, isEditing]);

    const displayTitle = isLoading ? "" : (title?.trim() || "New Sampling Rule");
    
    const handleEditClick = () => {
        setIsEditing(true);
    };

    const handleTitleSubmit = (value: string) => {
        const trimmedValue = value.trim();
        setTitle(trimmedValue);
        setIsEditing(false);
        onTitleChange?.(trimmedValue);
    };

    const handleTitleCancel = () => {
        setIsEditing(false);
    };

    return (
        <>
            {!isEditing ? (
                <div className="flex items-center gap-3">
                    <h1 className="font-display text-4xl first-letter:capitalize truncate max-w-2xl">{displayTitle}</h1>
                    {showEditButton && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleEditClick}
                            className="flex items-center gap-2 px-3 py-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        >
                            <Edit2 className="h-4 w-4" />
                            <span className="text-sm">Edit</span>
                        </Button>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 py-2">
                    <input
                        type="text"
                        placeholder="Enter rule name, e.g., Critical Issues"
                        value={title || ""}
                        maxLength={64}
                        onChange={(e) => {
                            const value = e.target.value;
                            const capitalizedValue = value.charAt(0).toUpperCase() + value.slice(1);
                            setTitle(capitalizedValue);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleTitleSubmit(e.currentTarget.value);
                            } else if (e.key === 'Escape') {
                                handleTitleCancel();
                            }
                        }}
                        onBlur={(e) => handleTitleSubmit(e.target.value)}
                        className="text-2xl font-display border border-black rounded-md outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] py-2 px-3 placeholder:text-neutral-400 placeholder:text-sm min-w-80"
                        style={{
                            width: `${Math.max(20, (title || "").length + 2)}ch`
                        }}
                        autoFocus
                    />
                </div>
            )}
        </>
    );
};

export default SamplingEditableTitle;