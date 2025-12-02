import { useState, useEffect } from 'react';
import { apiGet, apiPut, apiDelete } from '../services/api';
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
      preselection: auction.preselection_id
        ? {
            id: auction.preselection_id,
            colombia_time: auction.colombia_time || null,
            local_time: auction.local_time || null,
            auction_city: auction.auction_city || null,
            auction_date: auction.preselection_auction_date || auctionDate,
            supplier_name: auction.supplier_name || null,
            lot_number: auction.lot_number || null,
            brand: null,
            model: null,
            serial: null,
            year: null,
            hours: null,
            suggested_price: null,
            auction_url: null,
            decision: 'SI' as const,
            transferred_to_auction: true,
            auction_id: auction.id,
            comments: null,
            created_by: auction.created_by || '',
            created_at: auction.created_at || '',
            updated_at: auction.updated_at || '',
            transferred_at: null,
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

  const deleteAuction = async (id: string) => {
    try {
      await apiDelete(`/api/auctions/${id}`);
      setAuctions(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting auction:', error);
      throw error;
    }
  };

  return { auctions, isLoading, refetch: fetchAuctions, updateAuctionFields, deleteAuction };
};
