import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { BASE_URL } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useSocket = (eventNames: string[]) => {
  const [data, setData] = useState<any>({});
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const initSocket = async () => {
      const token = await AsyncStorage.getItem('token');
      
      // NestJS WebSocket Gateway biasanya butuh auth token
      socketRef.current = io(BASE_URL, {
        auth: { token },
        transports: ['websocket'],
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
        console.log('Socket Connected to:', BASE_URL);
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
        console.log('Socket Disconnected');
      });

      // Listen ke banyak event sekaligus
      eventNames.forEach(event => {
        socketRef.current?.on(event, (payload) => {
          setData((prev: any) => ({
            ...prev,
            [event]: payload
          }));
        });
      });
    };

    initSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const emit = (event: string, payload: any) => {
    socketRef.current?.emit(event, payload);
  };

  return { data, isConnected, emit };
};
