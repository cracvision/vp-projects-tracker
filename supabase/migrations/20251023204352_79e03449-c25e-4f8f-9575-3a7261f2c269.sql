-- Add DELETE policy to profiles table for complete RLS coverage
CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);