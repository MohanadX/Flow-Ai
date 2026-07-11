"use client";

import { generatePagination } from "@/lib/utils";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Button } from "../ui/button";
import { Dispatch, SetStateAction, useTransition } from "react";

export default function Pagination({
	totalPages,
	currentPage,
	setPage,
}: {
	totalPages: number;
	currentPage: number;
	setPage: Dispatch<SetStateAction<number>>;
}) {
	const [, startTransition] = useTransition();

	const setPageHandler = (value: ((prev: number) => number) | number) => {
		startTransition(() => {
			setPage(value);
		});
	};
	const allPages = generatePagination(currentPage, totalPages);

	return (
		<>
			<div className="inline-flex mt-7 mb-7">
				<PaginationArrow
					direction="left"
					setPage={() => setPageHandler((prev) => prev - 1)}
					isDisabled={currentPage <= 1}
				/>

				<div className="flex -space-x-px">
					{allPages.map((page, index) => {
						let position: "first" | "last" | "single" | "middle" | undefined;

						if (index === 0) position = "first";
						if (index === allPages.length - 1) position = "last";
						if (allPages.length === 1) position = "single";
						if (page === "...") position = "middle";

						return (
							<PaginationNumber
								key={`${page}-${index}`}
								setPage={setPageHandler}
								page={page}
								position={position}
								isActive={currentPage === page}
							/>
						);
					})}
				</div>

				<PaginationArrow
					direction="right"
					setPage={() => setPageHandler((prev) => prev + 1)}
					isDisabled={currentPage >= totalPages}
				/>
			</div>
		</>
	);
}

function PaginationNumber({
	page,
	setPage,
	isActive,
	position,
}: {
	page: number | string;
	setPage: Dispatch<SetStateAction<number>>;
	position?: "first" | "last" | "middle" | "single";
	isActive: boolean;
}) {
	const className = clsx(
		"flex h-7 w-7 items-center justify-center text-sm border rounded-none hover:text-foreground dark:hover:text-background",
		{
			"rounded-l-md": position === "first" || position === "single",
			"rounded-r-md": position === "last" || position === "single",
			"z-10 bg-blue-600 border-blue-600 text-white!": isActive,
			"hover:bg-gray-100": !isActive && position !== "middle",
			"text-gray-300": position === "middle",
		},
	);

	return isActive || position === "middle" ? (
		<div className={className}>{page}</div>
	) : (
		<Button
			className={className}
			onClick={() => {
				setPage(page as number);
			}}
		>
			{page}
		</Button>
	);
}

function PaginationArrow({
	direction,
	isDisabled,
	setPage,
}: {
	direction: "left" | "right";
	isDisabled?: boolean;
	setPage: () => void;
}) {
	const className = clsx(
		"flex h-7 w-7 items-center justify-center rounded-md border hover:text-foreground dark:hover:text-background",
		{
			"pointer-events-none text-gray-300": isDisabled,
			"hover:bg-gray-100": !isDisabled,
			"mr-2 md:mr-4": direction === "left",
			"ml-2 md:ml-4": direction === "right",
		},
	);

	const icon =
		direction === "left" ? (
			<ArrowLeftIcon className="w-4" />
		) : (
			<ArrowRightIcon className="w-4" />
		);

	return isDisabled ? (
		<div className={className}>{icon}</div>
	) : (
		<Button
			className={className}
			onClick={() => {
				setPage();
			}}
		>
			{icon}
		</Button>
	);
}
