import { useState, useEffect } from 'react';
import { apiGet, apiPut } from '../services/api';
import { AuctionWithRelations } from '../types/database';

export const useAuctions = () => {
  const [auctions, setAuctions] = useState<AuctionWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const mapAuctionRecord = (auction: any): AuctionWithRelations => {
    let auctionDate = auction.auction_date || auction.date;
    if (auctionDate) {
      if (typeof auctionDate === 'string') {
        auctionDate = auctionDate.split('T')[0];
      } else {
        auctionDate = new Date(auctionDate).toISOString().split('T')[0];
      }
    }

    return {
      ...auction,
      auction_date: auctionDate,
      lot_number: auction.lot_number || auction.lot,
      max_price: auction.max_price !== undefined ? Number(auction.max_price) : null,
      purchased_price: auction.purchased_price !== undefined ? Number(auction.purchased_price) : null,
      machine: auction.model || auction.brand || auction.serial
        ? {
            id: auction.machine_id,
            brand: auction.brand || null,
            model: auction.model || null,
            serial: auction.serial || null,
            year: auction.year || null,
            hours: auction.hours || null,
            drive_folder_id: auction.photos_folder_id || null,
            machine_type: auction.machine_type || null,
            wet_line: auction.wet_line || null,
            arm_type: auction.arm_type || null,
            track_width: auction.track_width || null,
            bucket_capacity: auction.bucket_capacity || null,
            warranty_months: auction.warranty_months || null,
            warranty_hours: auction.warranty_hours || null,
            engine_brand: auction.engine_brand || null,
            cabin_type: auction.cabin_type || null,
            blade: auction.blade || null,
            created_at: '',
            updated_at: '',
          }
        : null,
      supplier: auction.supplier_name
        ? {
            id: auction.supplier_id,
            name: auction.supplier_name,
            contact_email: null,
            phone: null,
            notes: null,
            created_at: '',
            updated_at: '',
          }
        : null,
    };
  };

  const fetchAuctions = async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<any[]>('/api/auctions');
      setAuctions(data.map(mapAuctionRecord));
    } catch (error) {
      console.error('Error fetching auctions:', error);
      setAuctions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateAuctionFields = async (id: string, updates: Record<string, unknown>) => {
    try {
      const updated = await apiPut<any>(`/api/auctions/${id}`, updates);
      const mapped = mapAuctionRecord(updated);
      setAuctions((prev) =>
        prev.map((auction) => (auction.id === id ? { ...auction, ...mapped } : auction))
      );
      return mapped;
    } catch (error) {
      console.error('Error updating auction:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchAuctions();
  }, []);

  return { auctions, isLoading, refetch: fetchAuctions, updateAuctionFields };
};
