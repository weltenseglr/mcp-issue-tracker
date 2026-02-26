import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { authApi } from "@/lib/api";

export function ApiKeyCopyButton() {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleCopyApiKey = async () => {
    if (loading) return;

    setLoading(true);

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        // Safari requires clipboard writes to be initiated synchronously within a
        // user gesture. Passing a Promise as ClipboardItem data keeps the gesture
        // context alive while the fetch resolves, so Safari accepts the write.
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": authApi.generateNewApiKey().then((response) => {
              if (!response.success || !response.apiKey?.key) {
                throw new Error("Failed to generate API key");
              }
              return new Blob([response.apiKey.key], { type: "text/plain" });
            })
          })
        ]);
      } else {
        // Fallback for older browsers without the Clipboard API
        const response = await authApi.generateNewApiKey();

        if (!response.success || !response.apiKey?.key) {
          throw new Error("Failed to generate API key");
        }

        const textArea = document.createElement("textarea");
        textArea.value = response.apiKey.key;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }

      setCopied(true);
      toast.success("New API key copied to clipboard!");

      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy API key:", error);
      toast.error("Failed to generate and copy API key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopyApiKey}
      disabled={loading}
      className="gap-2"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          {loading ? "Generating..." : "Copy API Key"}
        </>
      )}
    </Button>
  );
}
