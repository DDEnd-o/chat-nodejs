import { useEffect, useState } from 'react';
import { getSocket } from '../services/socket';

// Theo dõi navigator.onLine + trạng thái socket để biết lúc nào thiết bị có mạng trở lại
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine && Boolean(getSocket()?.connected));

    useEffect(() => {
        const computeStatus = () => navigator.onLine && Boolean(getSocket()?.connected);
        const update = () => setIsOnline(computeStatus());

        window.addEventListener('online', update);
        window.addEventListener('offline', update);

        const socket = getSocket();
        socket?.on('connect', update);
        socket?.on('disconnect', update);

        update();

        return () => {
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
            socket?.off('connect', update);
            socket?.off('disconnect', update);
        };
    }, []);

    return isOnline;
}
