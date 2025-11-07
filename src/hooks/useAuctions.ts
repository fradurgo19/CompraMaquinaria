import { useState, useEffect } from 'react';
import { apiGet } from '../services/api';
import { AuctionWithRelations } from '../types/database';

export const useAuctions = () => {
  const [auctions, setAuctions] = useState<AuctionWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAuctions = async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<any[]>('/api/auctions');
      
      // Mapear los datos del backend al formato esperado por el frontend
      const mappedAuctions = data.map((auction: any) => {
        // Convertir fecha a formato YYYY-MM-DD
        let auctionDate = auction.auction_date || auction.date;
        if (auctionDate) {
          // Si es string, extraer solo la parte de fecha
          if (typeof auctionDate === 'string') {
            auctionDate = auctionDate.split('T')[0];
          } else {
            // Si es Date object, convertir
            auctionDate = new Date(auctionDate).toISOString().split('T')[0];
          }
        }
        
        return {
          ...auction,
          // Asegurar que auction_date existe y está en formato correcto
          auction_date: auctionDate,
          lot_number: auction.lot_number || auction.lot,
          max_price: parseFloat(auction.max_price || 0),
          purchased_price: auction.purchased_price ? parseFloat(auction.purchased_price) : null,
        machine: auction.model ? {
          id: auction.machine_id,
          brand: auction.brand || null,
          model: auction.model,
          serial: auction.serial,
          year: auction.year || 0,
          hours: auction.hours || 0,
          drive_folder_id: auction.photos_folder_id,
          // Especificaciones técnicas
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
          updated_at: ''
        } : null,
        supplier: auction.supplier_name ? {
          id: auction.supplier_id,
          name: auction.supplier_name,
          contact_email: null,
          phone: null,
          notes: null,
          created_at: '',
          updated_at: ''
        } : null
        };
      });
      
      setAuctions(mappedAuctions);
    } catch (error) {
      console.error('Error fetching auctions:', error);
      setAuctions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
  }, []);

  return { auctions, isLoading, refetch: fetchAuctions };
};
