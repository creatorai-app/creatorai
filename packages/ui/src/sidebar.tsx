"use client";
import { cn } from "./lib/utils";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-m";
import { IconMenu2, IconX, IconLock } from "@tabler/icons-react";

interface Links {
    label: string;
    href: string;
    icon: React.JSX.Element | React.ReactNode;
    badge?: string;
    locked?: boolean;
}

interface SidebarContextProps {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
    undefined
);

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
};

export const SidebarProvider = ({
                                    children,
                                    open: openProp,
                                    setOpen: setOpenProp,
                                    animate = true,
                                }: {
    children: React.ReactNode;
    open?: boolean;
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    animate?: boolean;
}) => {
    const [openState, setOpenState] = useState(false);

    const open = openProp !== undefined ? openProp : openState;
    const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

    return (
        <SidebarContext.Provider value={{ open, setOpen, animate: animate }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const Sidebar = ({
                            children,
                            open,
                            setOpen,
                            animate,
                        }: {
    children: React.ReactNode;
    open?: boolean;
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    animate?: boolean;
}) => {
    return (
        <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
            {children}
        </SidebarProvider>
    );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
    return (
        <>
            <DesktopSidebar {...props} />
            <MobileSidebar {...(props as React.ComponentProps<"div">)} />
        </>
    );
};

export const DesktopSidebar = ({
                                   className,
                                   children,
                                   ...props
                               }: React.ComponentProps<typeof motion.div>) => {
    const { open, setOpen, animate } = useSidebar();
    return (
        <motion.div
            className={cn(
                "h-full px-4 py-4 hidden md:flex md:flex-col bg-white dark:bg-neutral-800 shrink-0 border-r border-neutral-200 dark:border-neutral-700",
                className
            )}
            animate={{
                width: animate ? (open ? "300px" : "80px") : "300px",
            }}
            initial={false}
            transition={{
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1], // Custom easing for smoother feel
            }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export const MobileSidebar = ({
                                  className,
                                  children,
                                  ...props
                              }: React.ComponentProps<"div">) => {
    const { open, setOpen } = useSidebar();
    return (
        <>
            <div
                className={cn(
                    "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-neutral-100 dark:bg-neutral-800 w-full"
                )}
                {...props}
            >
                <div className="flex justify-end z-20 w-full">
                    <IconMenu2
                        className="text-neutral-800 dark:text-neutral-200 cursor-pointer"
                        onClick={() => setOpen(!open)}
                    />
                </div>
                <AnimatePresence>
                    {open && (
                        <motion.div
                            initial={{ x: "-100%", opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: "-100%", opacity: 0 }}
                            transition={{
                                duration: 0.3,
                                ease: "easeInOut",
                            }}
                            className={cn(
                                "fixed h-full w-full inset-0 bg-white dark:bg-neutral-900 p-10 z-[100] flex flex-col justify-between",
                                className
                            )}
                        >
                            <div
                                className="absolute right-10 top-10 z-50 text-neutral-800 dark:text-neutral-200 cursor-pointer"
                                onClick={() => setOpen(!open)}
                            >
                                <IconX />
                            </div>
                            {children}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
};

export const SidebarLink = ({
                                link,
                                className,
                                ...props
                            }: {
    link: Links;
    className?: string;
}) => {
    const { open, animate } = useSidebar();
    const Comp = link.locked ? "div" : "a";

    return (
        <Comp
            {...(!link.locked && { href: link.href })}
            className={cn(
                "flex items-center gap-2 group/sidebar relative",
                link.locked && "opacity-50 cursor-not-allowed pointer-events-none",
                className
            )}
            {...props}
        >
            <span className="shrink-0">{link.icon}</span>

            <motion.span
                animate={{
                    width: animate ? (open ? "auto" : 0) : "auto",
                    opacity: animate ? (open ? 1 : 0) : 1,
                }}
                initial={false}
                transition={{
                    duration: 0.3,
                    ease: [0.4, 0, 0.2, 1],
                    opacity: { duration: open ? 0.3 : 0.15 }
                }}
                className="text-sm whitespace-nowrap overflow-hidden flex items-center gap-2"
            >
                {link.label}
                {link.badge && open && (
                    <span className="text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.5 rounded-full leading-none">
                        {link.badge}
                    </span>
                )}
                {link.locked && open && (
                    <IconLock className="h-3 w-3 text-gray-400" />
                )}
            </motion.span>
        </Comp>
    );
};