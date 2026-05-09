export interface ApiResponse<T = any> {
	success: boolean;
	message?: string;
	data?: T;
	error?: string;
	errors?: any[];
	meta?: {
		page?: number;
		limit?: number;
		total?: number;
		totalPages?: number;
	};
	code?: string; // Optional semantic error code
}
