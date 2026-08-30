
import React from 'react';

const FileTextIcon = ({ className = 'w-16 h-16' }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            // The 'group' class enables group-hover utilities on child elements
            className={`group cursor-pointer ${className}`}
        >
            {/* This group contains the file shape. It will "jiggle" on hover. */}
            {/* We set a transform-origin to make the rotation look natural. */}
            <g className="group-hover:animate-file-jiggle" style={{ transformOrigin: '50% 70%' }}>
                <path
                    d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
                    className="fill-white dark:fill-gray-800 group-hover:fill-blue-50 dark:group-hover:fill-gray-700 transition-colors duration-300"
                />
                <polyline points="14 2 14 8 20 8" />
            </g>
            <g className="group-hover:animate-text-slide-in">
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
            </g>
        </svg>
    );
};

export default FileTextIcon;
