
import { CommercialCard, FinancialCard, OperationCard, InternalTaskCard } from '../types';
import { Timestamp } from 'firebase/firestore';

const CALENDAR_ID = 'primary';

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

class GoogleCalendarService {
  private accessToken: string | null = null;

  setAccessToken(token: string) {
    this.accessToken = token;
    localStorage.setItem('google_access_token', token);
  }

  getAccessToken() {
    return this.accessToken || localStorage.getItem('google_access_token');
  }

  async syncCard(card: CommercialCard | FinancialCard | OperationCard | InternalTaskCard, sectorType: string): Promise<string | null> {
    const token = this.getAccessToken();
    if (!token) {
      console.warn('Google Calendar Sync: No access token available');
      return null;
    }

    const startDate = this.formatDate(card.startDate);
    const deliveryDate = this.formatDate(card.deliveryDate || card.startDate);

    if (!startDate) return null;

    const event: GoogleCalendarEvent = {
      summary: `[${sectorType.toUpperCase()}] ${card.title || (card as any).clientName || 'Sem título'}`,
      description: card.notes || '',
      start: {
        date: startDate,
      },
      end: {
        date: deliveryDate || startDate,
      },
    };

    try {
      let url = `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`;
      let method = 'POST';

      if (card.googleEventId) {
        url += `/${card.googleEventId}`;
        method = 'PUT';
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Google Calendar Sync Error:', error);
        
        // If event not found (deleted manually in calendar), try creating it
        if (response.status === 404 && card.googleEventId) {
           return this.syncCard({ ...card, googleEventId: undefined }, sectorType);
        }
        return null;
      }

      const data = await response.json();
      console.log('Successfully synced to Google Calendar:', data.id);
      return data.id;
    } catch (error) {
      console.error('Error syncing to Google Calendar:', error);
      return null;
    }
  }

  async deleteEvent(eventId: string) {
    const token = this.getAccessToken();
    if (!token) return;

    try {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
    }
  }

  private formatDate(date: any): string | null {
    if (!date) return null;
    let d: Date;
    if (date instanceof Timestamp) {
      d = date.toDate();
    } else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else if (date && typeof date.toDate === 'function') {
      d = date.toDate();
    } else {
      return null;
    }
    
    if (isNaN(d.getTime())) return null;
    
    // Use local date to avoid timezone shifts
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export const googleCalendarService = new GoogleCalendarService();
