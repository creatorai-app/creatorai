"use client";
import { cn } from "./lib/utils";
import { IconMenu2, IconX } from "@tabler/icons-react";
import {
    motion,
    AnimatePresence,
    useScroll,
    useMotionValueEvent,
} from "motion/react";

import React, { useRef, useState } from "react";


interface NavbarProps {
    children: React.ReactNode;
    className?: string;
}

interface NavBodyProps {
    children: React.ReactNode;
    className?: string;
    visible?: boolean;
}

interface NavItemsProps {
    items: {
        name: string;
        href: string;
    }[];
    className?: string;
    onItemClick?: () => void;
}

interface MobileNavProps {
    children: React.ReactNode;
    className?: string;
    visible?: boolean;
}

interface MobileNavHeaderProps {
    children: React.ReactNode;
    className?: string;
}

interface MobileNavMenuProps {
    children: React.ReactNode;
    className?: string;
    isOpen: boolean;
    onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollY } = useScroll({
        target: ref,
        offset: ["start start", "end start"],
    });
    const [visible, setVisible] = useState<boolean>(false);

    useMotionValueEvent(scrollY, "change", (latest) => {
        if (latest > 100) {
            setVisible(true);
        } else {
            setVisible(false);
        }
    });

    return (
        <motion.div
            ref={ref}
            className={cn(
                "fixed inset-x-0 top-0 z-50 w-full",
                "border-b border-black/[0.06] dark:border-white/10",
                "backdrop-blur-[12px] backdrop-saturate-[180%]",
                "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)]",
                "transition-[background-color,box-shadow] duration-300 ease-out",
                visible
                    ? "bg-white/85 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),0_4px_24px_-8px_rgba(0,0,0,0.08)] dark:bg-neutral-950/85"
                    : "bg-white/70 dark:bg-neutral-950/70",
                className,
            )}
            style={{ WebkitBackdropFilter: "blur(12px) saturate(180%)" }}
        >
            <div className="relative w-full">
                {React.Children.map(children, (child) =>
                    React.isValidElement(child)
                        ? React.cloneElement(
                            child as React.ReactElement<{ visible?: boolean }>,
                            { visible },
                        )
                        : child,
                )}
            </div>
        </motion.div>
    );
};

export const NavBody = ({ children, className }: NavBodyProps) => {
    return (
        <motion.div
            animate={{
                y: 0,
            }}
            transition={{
                type: "spring",
                stiffness: 200,
                damping: 50,
            }}
            className={cn(
                "relative z-[60] mx-auto hidden w-full max-w-none flex-row items-center justify-between px-6 py-3 lg:flex lg:px-10",
                className,
            )}
        >
            {children}
        </motion.div>
    );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
    const [hovered, setHovered] = useState<number | null>(null);

    return (
        <motion.div
            onMouseLeave={() => setHovered(null)}
            className={cn(
                "absolute inset-0 hidden flex-1 flex-row items-center justify-center space-x-2 text-sm font-medium text-zinc-600 transition duration-200 hover:text-zinc-800 lg:flex lg:space-x-2",
                className,
            )}
        >
            {items.map((item, idx) => (
                <a
                    onMouseEnter={() => setHovered(idx)}
                    onClick={onItemClick}
                    className="relative px-4 py-2 text-neutral-600 dark:text-neutral-300"
                    key={`link-${idx}`}
                    href={item.href}
                >
                    {hovered === idx && (
                        <motion.div
                            layoutId="hovered"
                            className="absolute inset-0 h-full w-full rounded-full bg-gray-100 dark:bg-neutral-800"
                        />
                    )}
                    <span className="relative z-20">{item.name}</span>
                </a>
            ))}
        </motion.div>
    );
};

export const MobileNav = ({ children, className }: MobileNavProps) => {
    return (
        <motion.div
            animate={{
                y: 0,
            }}
            transition={{
                type: "spring",
                stiffness: 200,
                damping: 50,
            }}
            className={cn(
                "relative z-50 mx-auto flex w-full max-w-none flex-col items-center justify-between px-6 py-3 lg:hidden",
                className,
            )}
        >
            {children}
        </motion.div>
    );
};

export const MobileNavHeader = ({
    children,
    className,
}: MobileNavHeaderProps) => {
    return (
        <div
            className={cn(
                "flex w-full flex-row items-center justify-between",
                className,
            )}
        >
            {children}
        </div>
    );
};

export const MobileNavMenu = ({
    children,
    className,
    isOpen,
    onClose,
}: MobileNavMenuProps) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                        "absolute inset-x-0 top-16 z-50 flex w-full flex-col items-start justify-start gap-4 border-t border-black/[0.06] bg-white/85 px-6 py-8 backdrop-blur-[12px] backdrop-saturate-[180%] dark:border-white/10 dark:bg-neutral-950/85",
                        className,
                    )}
                    style={{ WebkitBackdropFilter: "blur(12px) saturate(180%)" }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export const MobileNavToggle = ({
    isOpen,
    onClick,
}: {
    isOpen: boolean;
    onClick: () => void;
}) => {
    return isOpen ? (
        <IconX className="text-black dark:text-white" onClick={onClick} />
    ) : (
        <IconMenu2 className="text-black dark:text-white" onClick={onClick} />
    );
};

type NavbarButtonProps<T extends React.ElementType> = {
    href?: string;
    as?: T;
    children: React.ReactNode;
    className?: string;
    variant?: "primary" | "secondary" | "dark" | "gradient";
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children" | "variant" | "href">;

export const NavbarButton = <T extends React.ElementType = "a">({
    href,
    as,
    children,
    className,
    variant = "primary",
    ...props
}: NavbarButtonProps<T>) => {
    const Tag = as || "a";

    const baseStyles =
        "px-4 py-2 rounded-md bg-white button bg-white text-black text-sm font-bold relative cursor-pointer hover:-translate-y-0.5 transition duration-200 inline-block text-center";

    const variantStyles: Record<"primary" | "secondary" | "dark" | "gradient", string> = {
        primary:
            "shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]",
        secondary: "bg-transparent shadow-none dark:text-white",
        dark: "bg-black text-white shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]",
        gradient:
            "bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset]",
    };

    return React.createElement(
        Tag,
        {
            ...(href ? { href } : {}),
            className: cn(baseStyles, variantStyles[variant], className),
            ...props,
        },
        children
    );
};
