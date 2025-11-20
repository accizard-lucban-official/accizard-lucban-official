import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function NotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    requestPermission,
    toggleSubscription,
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-orange" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Receive real-time notifications for announcements, report updates, and messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Push notifications are not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getPermissionStatus = () => {
    if (permission === 'granted') {
      return {
        icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
        text: 'Permission granted',
        color: 'text-green-600',
      };
    } else if (permission === 'denied') {
      return {
        icon: <AlertCircle className="h-5 w-5 text-red-600" />,
        text: 'Permission denied',
        color: 'text-red-600',
      };
    } else {
      return {
        icon: <AlertCircle className="h-5 w-5 text-yellow-600" />,
        text: 'Permission not requested',
        color: 'text-yellow-600',
      };
    }
  };

  const permissionStatus = getPermissionStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-brand-orange" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive real-time notifications for announcements, report updates, and messages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {permissionStatus.icon}
              <span className={`text-sm font-medium ${permissionStatus.color}`}>
                {permissionStatus.text}
              </span>
            </div>
            {permission !== 'granted' && (
              <Button
                size="sm"
                onClick={requestPermission}
                disabled={isLoading || permission === 'denied'}
                className="bg-brand-orange hover:bg-brand-orange-400 text-white"
              >
                {isLoading ? 'Requesting...' : 'Request Permission'}
              </Button>
            )}
          </div>

          {permission === 'denied' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Notification permission was denied. To enable push notifications:
                <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                  <li>Click the lock/info icon in your browser's address bar</li>
                  <li>Find "Notifications" in the permissions list</li>
                  <li>Change it from "Block" to "Allow"</li>
                  <li>Refresh this page</li>
                </ol>
              </AlertDescription>
            </Alert>
          )}

          {permission === 'granted' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {isSubscribed ? (
                    <Bell className="h-5 w-5 text-green-600" />
                  ) : (
                    <BellOff className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {isSubscribed ? 'Notifications Enabled' : 'Notifications Disabled'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isSubscribed
                        ? 'You will receive push notifications for announcements, report updates, and messages'
                        : 'Enable push notifications to stay updated'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={toggleSubscription}
                  disabled={isLoading}
                  variant={isSubscribed ? 'outline' : 'default'}
                  className={isSubscribed ? '' : 'bg-brand-orange hover:bg-brand-orange-400 text-white'}
                >
                  {isLoading
                    ? 'Updating...'
                    : isSubscribed
                    ? 'Disable'
                    : 'Enable'}
                </Button>
              </div>

              {isSubscribed && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    You're all set! You'll receive notifications for:
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li>New announcements (weather warnings, emergencies, etc.)</li>
                      <li>Report status updates (when your reports are responded to)</li>
                      <li>Chat messages from AcciZard Support</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

