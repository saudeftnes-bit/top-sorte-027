// Database types for Supabase tables

export interface Raffle {
    id: string;
    title: string;
    description: string;
    price_per_number: number;
    main_image_url: string;
    instagram_url?: string;
    total_numbers?: number;
    selection_mode?: 'loteria' | 'jogo_bicho';
    selection_timeout?: number;
    payment_timeout?: number;
    status: 'active' | 'finished' | 'scheduled';
    draw_date?: string;
    created_at: string;
    updated_at: string;
}

export interface Reservation {
    id: string;
    raffle_id: string;
    number: string;
    buyer_name: string;
    buyer_phone?: string;
    buyer_email?: string;
    status: 'pending' | 'paid' | 'cancelled';
    payment_amount?: number;
    payment_proof_url?: string;
    expires_at?: string; // Timer de expiração (30 minutos)
    created_at: string;
    updated_at: string;
}

export interface WinnerPhoto {
    id: string;
    name: string;
    prize: string;
    photo_url?: string;
    media_type?: 'photo' | 'youtube' | 'instagram';
    video_url?: string;
    display_order: number;
    created_at: string;
}

// Analytics types
export interface RaffleAnalytics {
    totalRevenue: number;
    numbersSold: number;
    numbersPending: number;
    numbersAvailable: number;
    totalBuyers: number;
}
